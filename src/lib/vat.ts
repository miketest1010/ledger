import { monthKeyOf, pad2 } from './dates.ts'
import type { LedgerRecord, Scope } from './types.ts'

/** 諾奇意從這個月起開統一發票，支出也從這個月起才算記齊。 */
export const UNIFORM_INVOICE_START = '2026-11'
export const INCOMPLETE_EXPENSE_NOTE = '支出不完整，僅供參考'

export function cafeExpenseIncomplete(month: string, scope: Scope): boolean {
  return scope !== 'laya' && month < UNIFORM_INVOICE_START
}

/** 含稅價拆成未稅與 5% 稅額。稅額四捨五入到元，兩者相加回到原金額。 */
export function splitInclusiveVat(amount: number): { preTax: number; tax: number } {
  const tax = Math.round((amount * 5) / 105)
  return { preTax: amount - tax, tax }
}

export function biMonthlyBounds(month: string): { start: string; end: string } {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  const startMonth = monthNumber % 2 === 0 ? monthNumber - 1 : monthNumber
  return {
    start: `${year}-${pad2(startMonth)}`,
    end: `${year}-${pad2(startMonth + 1)}`,
  }
}

export interface VatPeriod {
  start: string
  end: string
  label: string
  outputRecorded: number
  outputEstimated: number
  inputRecorded: number
  output: number
  input: number
  payable: number
  estimatedIncomeCount: number
  recordedIncomeCount: number
  recordedExpenseCount: number
}

function periodLabel(start: string, end: string): string {
  const [year, startMonth] = start.split('-')
  const endMonth = end.split('-')[1]
  return `${year}年${Number(startMonth)}–${Number(endMonth)}月`
}

function advanceTwoMonths(month: string): string {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  return monthNumber + 2 > 12 ? monthKeyOf(year + 1, monthNumber + 2 - 12) : monthKeyOf(year, monthNumber + 2)
}

/**
 * 諾奇意的單月期營業稅。
 * 有填稅額的收入、支出用登錄值（銷項、進項）。
 * 11 月起還沒填稅額的營收，把金額當成含稅價來估算銷項。
 * 沒填稅額的支出不估算進項，因為薪資、保險這類常常沒有發票。
 */
export function estimateCafeVat(records: LedgerRecord[], todayMonth: string): VatPeriod[] {
  const first = biMonthlyBounds(UNIFORM_INVOICE_START).start
  const last = biMonthlyBounds(todayMonth < UNIFORM_INVOICE_START ? UNIFORM_INVOICE_START : todayMonth).start
  const periods: VatPeriod[] = []
  for (let cursor = first; cursor <= last; cursor = advanceTwoMonths(cursor)) {
    const bounds = biMonthlyBounds(cursor)
    let outputRecorded = 0
    let outputEstimated = 0
    let inputRecorded = 0
    let estimatedIncomeCount = 0
    let recordedIncomeCount = 0
    let recordedExpenseCount = 0
    for (const record of records) {
      if (record.businessId !== 'cafe' || record.status !== 'paid' || record.closed || record.gap) continue
      if (record.accountingMonth < bounds.start || record.accountingMonth > bounds.end) continue
      if (record.type === 'income') {
        if (record.tax !== null) {
          outputRecorded += record.tax
          recordedIncomeCount += 1
        } else if (record.accountingMonth >= UNIFORM_INVOICE_START && record.amount > 0) {
          outputEstimated += splitInclusiveVat(record.amount).tax
          estimatedIncomeCount += 1
        }
      } else if (record.type === 'expense' && record.tax !== null) {
        inputRecorded += record.tax
        recordedExpenseCount += 1
      }
    }
    const output = outputRecorded + outputEstimated
    periods.push({
      ...bounds,
      label: periodLabel(bounds.start, bounds.end),
      outputRecorded,
      outputEstimated,
      inputRecorded,
      output,
      input: inputRecorded,
      payable: output - inputRecorded,
      estimatedIncomeCount,
      recordedIncomeCount,
      recordedExpenseCount,
    })
  }
  return periods
}
