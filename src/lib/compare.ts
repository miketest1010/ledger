import { findCategory } from './defaults.ts'
import type { Business, CategoryKind, LedgerRecord, Scope } from './types.ts'

export type CompareBasis = 'paid' | 'planned' | 'both'

export interface MonthAmount {
  paid: number
  planned: number
}

export interface CompareDelta {
  difference: number
  /** Null when the earlier month is 0, so a percentage would not mean anything. */
  percent: number | null
}

export interface CompareCategory {
  key: string
  name: string
  kind: 'income' | 'expense'
  amounts: MonthAmount[]
}

export interface CompareModel {
  /** Chronological, oldest first, so each difference reads against the month on its left. */
  months: string[]
  income: MonthAmount[]
  expense: MonthAmount[]
  net: MonthAmount[]
  categories: CompareCategory[]
}

export function emptyAmount(): MonthAmount {
  return { paid: 0, planned: 0 }
}

export function amountOf(cell: MonthAmount, basis: CompareBasis): number {
  if (basis === 'paid') return cell.paid
  if (basis === 'planned') return cell.planned
  return cell.paid + cell.planned
}

export function monthDelta(current: number, previous: number): CompareDelta {
  const difference = current - previous
  if (previous === 0) return { difference, percent: null }
  return { difference, percent: (difference / Math.abs(previous)) * 100 }
}

function inScope(record: LedgerRecord, scope: Scope): boolean {
  return scope === 'all' || record.businessId === scope
}

function add(cell: MonthAmount, status: LedgerRecord['status'], amount: number): void {
  if (status === 'planned') cell.planned += amount
  else if (status === 'paid') cell.paid += amount
}

function categoryName(record: LedgerRecord, businesses: Business[], scope: Scope): string {
  const category = findCategory(businesses, record.categoryId)
  const name = category?.name ?? '未分類'
  if (scope !== 'all') return name
  const business = businesses.find((item) => item.id === record.businessId)
  return `${business?.name ?? record.businessId}・${name}`
}

/**
 * Side-by-side accounting-month totals.
 * Settlements, closed days, missing days, and refundable amounts stay out of income, expense, and net.
 */
export function compareMonths(input: {
  records: LedgerRecord[]
  businesses: Business[]
  scope: Scope
  months: string[]
}): CompareModel {
  const months = [...new Set(input.months.filter((month) => month))].sort()
  const index = new Map(months.map((month, position) => [month, position]))
  const income = months.map(() => emptyAmount())
  const expense = months.map(() => emptyAmount())
  const categories = new Map<string, CompareCategory>()

  for (const record of input.records) {
    if (!inScope(record, input.scope)) continue
    const position = index.get(record.accountingMonth)
    if (position === undefined) continue
    if (record.closed || record.gap || record.refundable) continue
    if (record.type === 'settlement') continue
    if (record.type !== 'income' && record.type !== 'expense') continue
    const kind: CategoryKind = record.type
    const target = kind === 'income' ? income[position] : expense[position]
    if (!target) continue
    add(target, record.status, record.amount)
    const key = `${record.businessId}:${record.categoryId}`
    const existing = categories.get(key) ?? {
      key,
      name: categoryName(record, input.businesses, input.scope),
      kind,
      amounts: months.map(() => emptyAmount()),
    }
    const cell = existing.amounts[position]
    if (cell) add(cell, record.status, record.amount)
    categories.set(key, existing)
  }

  const net = months.map((_, position) => ({
    paid: (income[position]?.paid ?? 0) - (expense[position]?.paid ?? 0),
    planned: (income[position]?.planned ?? 0) - (expense[position]?.planned ?? 0),
  }))

  const rows = [...categories.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'income' ? -1 : 1
    const last = months.length - 1
    const aAmount = amountOf(a.amounts[last] ?? emptyAmount(), 'both')
    const bAmount = amountOf(b.amounts[last] ?? emptyAmount(), 'both')
    return bAmount - aAmount || a.name.localeCompare(b.name, 'zh-Hant')
  })

  return { months, income, expense, net, categories: rows }
}
