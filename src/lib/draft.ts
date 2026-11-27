import { findBusiness } from './defaults.ts'
import { isMonthKey, monthKeyOf, parseISODate, type TaipeiDate } from './dates.ts'
import { parseTwdInput } from './money.ts'
import type { Business, BusinessId, EntryStatus, EntryType, LedgerRecord, PaymentSplit } from './types.ts'
import { newId } from './utils.ts'

export interface SplitDraft {
  method: string
  amount: string
}

export interface Draft {
  id: string | null
  businessId: BusinessId
  date: string
  accountingMonth: string
  monthTouched: boolean
  type: EntryType
  categoryId: string
  amount: string
  note: string
  paymentMethod: string
  useSplits: boolean
  splits: SplitDraft[]
  vendor: string
  productLine: string
  refundable: boolean
  status: EntryStatus
  periodStart: string
  periodEnd: string
  closed: boolean
  gap: boolean
  oneOff: boolean
  useTax: boolean
  preTax: string
  tax: string
  seed: boolean
  createdAt: string | null
}

function firstCategory(business: Business | undefined, type: EntryType): string {
  return business?.categories.find((category) => category.kind === type)?.id ?? ''
}

export function blankDraft(businessId: BusinessId, today: TaipeiDate, businesses: Business[]): Draft {
  const business = findBusiness(businesses, businessId)
  const type: EntryType = businessId === 'cafe' ? 'income' : 'expense'
  return {
    id: null,
    businessId,
    date: today.iso,
    accountingMonth: today.monthKey,
    monthTouched: false,
    type,
    categoryId: firstCategory(business, type),
    amount: '',
    note: '',
    paymentMethod: '',
    useSplits: false,
    splits: [
      { method: '現金', amount: '' },
      { method: 'Line Pay', amount: '' },
    ],
    vendor: '',
    productLine: '',
    refundable: false,
    status: 'paid',
    periodStart: '',
    periodEnd: '',
    closed: false,
    gap: false,
    oneOff: false,
    useTax: false,
    preTax: '',
    tax: '',
    seed: false,
    createdAt: null,
  }
}

export function draftFromRecord(record: LedgerRecord): Draft {
  return {
    id: record.id,
    businessId: record.businessId,
    date: record.date,
    accountingMonth: record.accountingMonth,
    monthTouched: true,
    type: record.type,
    categoryId: record.categoryId,
    amount: String(record.amount),
    note: record.note,
    paymentMethod: record.paymentMethod,
    useSplits: record.splits.length > 0,
    splits:
      record.splits.length > 0
        ? record.splits.map((split) => ({ method: split.method, amount: String(split.amount) }))
        : [
            { method: '現金', amount: '' },
            { method: 'Line Pay', amount: '' },
          ],
    vendor: record.vendor,
    productLine: record.productLine,
    refundable: record.refundable,
    status: record.status,
    periodStart: record.periodStart ?? '',
    periodEnd: record.periodEnd ?? '',
    closed: record.closed,
    gap: record.gap,
    oneOff: record.oneOff,
    useTax: record.preTax !== null || record.tax !== null,
    preTax: record.preTax === null ? '' : String(record.preTax),
    tax: record.tax === null ? '' : String(record.tax),
    seed: record.seed,
    createdAt: record.createdAt,
  }
}

export function applyDraftPatch(draft: Draft, patch: Partial<Draft>, businesses: Business[]): Draft {
  const next: Draft = { ...draft, ...patch }
  if (patch.date && !draft.monthTouched) {
    const parsed = parseISODate(patch.date)
    if (parsed) next.accountingMonth = monthKeyOf(parsed.y, parsed.m)
  }
  if (patch.accountingMonth !== undefined) next.monthTouched = true
  if (patch.businessId || patch.type) {
    const business = findBusiness(businesses, next.businessId)
    const category = business?.categories.find((item) => item.id === next.categoryId)
    if (!category || category.kind !== next.type) next.categoryId = firstCategory(business, next.type)
  }
  if (patch.type && patch.type !== 'income') next.useSplits = false
  if (patch.type && patch.type !== 'expense') {
    next.refundable = false
    next.oneOff = false
  }
  if (patch.closed) {
    next.amount = '0'
    next.type = 'income'
    next.useTax = false
  }
  if (patch.type === 'settlement') next.useTax = false
  return next
}

export function validateDraft(
  draft: Draft,
  businesses: Business[],
): { ok: true; record: LedgerRecord } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const business = findBusiness(businesses, draft.businessId)
  if (!business) errors.push('請選擇店別')
  if (!parseISODate(draft.date)) errors.push('請填付款或營業日期')
  if (!isMonthKey(draft.accountingMonth)) errors.push('帳務月份要像 2026-10')
  const category = business?.categories.find((item) => item.id === draft.categoryId)
  if (!category || category.kind !== draft.type) errors.push('請選擇和類型相符的分類')

  let amount = 0
  let splits: PaymentSplit[] = []
  if (draft.closed) {
    if (draft.type !== 'income') errors.push('公休只用於收入')
    amount = 0
  } else if (draft.useSplits && draft.type === 'income') {
    for (const row of draft.splits) {
      if (!row.method.trim() && !row.amount.trim()) continue
      if (!row.method.trim()) {
        errors.push('收款方式要填名稱')
        continue
      }
      const parsed = parseTwdInput(row.amount.trim() === '' ? '0' : row.amount)
      if (parsed === null) errors.push(`「${row.method.trim()}」的金額要是 0 以上的整數`)
      else splits.push({ method: row.method.trim(), amount: parsed })
    }
    if (splits.length === 0) errors.push('請至少填一個收款方式')
    amount = splits.reduce((sum, split) => sum + split.amount, 0)
  } else {
    const parsed = parseTwdInput(draft.amount)
    if (parsed === null) errors.push('金額請填 0 以上的整數')
    else amount = parsed
  }

  const periodStart = draft.periodStart.trim()
  const periodEnd = draft.periodEnd.trim()
  if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) errors.push('期間要起迄都填，或都留空')
  if (periodStart && !parseISODate(periodStart)) errors.push('期間開始的日期不對')
  if (periodEnd && !parseISODate(periodEnd)) errors.push('期間結束的日期不對')
  if (periodStart && periodEnd && periodStart > periodEnd) errors.push('期間的開始不能晚於結束')

  let preTax: number | null = null
  let tax: number | null = null
  if (draft.useTax && draft.type !== 'settlement' && !draft.closed) {
    const parsedPreTax = parseTwdInput(draft.preTax)
    const parsedTax = parseTwdInput(draft.tax)
    if (parsedPreTax === null || parsedTax === null) errors.push('未稅金額和稅額都要填 0 以上的整數')
    else if (parsedPreTax + parsedTax !== amount) errors.push('未稅金額加稅額要等於含稅金額')
    else {
      preTax = parsedPreTax
      tax = parsedTax
    }
  }

  if (errors.length > 0 || !business || !category) return { ok: false, errors }
  const now = new Date().toISOString()
  return {
    ok: true,
    record: {
      id: draft.id ?? newId('rec'),
      businessId: draft.businessId,
      date: draft.date,
      accountingMonth: draft.accountingMonth,
      type: draft.type,
      categoryId: category.id,
      amount,
      preTax,
      tax,
      note: draft.note.trim(),
      paymentMethod: draft.useSplits ? '' : draft.paymentMethod.trim(),
      splits,
      vendor: draft.vendor.trim(),
      productLine: draft.productLine.trim(),
      refundable: draft.type === 'expense' ? draft.refundable : false,
      status: draft.status,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      closed: draft.closed,
      gap: draft.gap,
      oneOff: draft.type === 'expense' ? draft.oneOff : false,
      seed: draft.seed,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    },
  }
}
