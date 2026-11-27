import { spreadAmount } from './accrual.ts'
import { CAFE_OTHER_INCOME, findCategory } from './defaults.ts'
import { monthKeyOf, monthSequence } from './dates.ts'
import { shareAmount } from './money.ts'
import type { Business, LedgerMode, LedgerRecord, Scope } from './types.ts'
import { CASH_METHOD, LINE_PAY_METHOD } from './types.ts'

export interface Totals {
  income: number
  /** 其他收入，不含每日營業額。已含在 income 裡。 */
  otherIncome: number
  cash: number
  linePay: number
  expense: number
  refundable: number
  plannedExpense: number
  plannedRefundable: number
  settlements: number
  /** 以前年度或一次性支出。不論有沒有從營業觀點排除，都記在這裡。 */
  oneOff: number
  net: number
}

export interface MonthRow extends Totals {
  month: string
}

export interface CategorySlice {
  key: string
  name: string
  amount: number
}

export interface VendorSlice {
  vendor: string
  amount: number
}

export interface ProductLineSlice {
  name: string
  amount: number
}

export interface MonthFacts {
  closed: string[]
  gaps: string[]
  missing: string[]
}

export interface StartupSummary {
  paidSunk: number
  paidRefundable: number
  plannedSunk: number
  plannedRefundable: number
  plannedUnpaid: number
  invested: number
  estimatedSunk: number
  estimatedAll: number
  sharePercent: number | null
  shareOfSunk: number | null
  shareOfRefundable: number | null
  pending: { id: string; note: string }[]
}

export interface DashboardModel {
  thisMonth: Totals
  ytd: Totals
  months: MonthRow[]
  categories: CategorySlice[]
  vendors: VendorSlice[]
  productLines: ProductLineSlice[]
  goodsWithoutVendor: number
  startup: StartupSummary | null
  detail: Totals
  futureAccrual: number
  thisFacts: MonthFacts
  detailFacts: MonthFacts | null
}

export type DetailRange = { kind: 'ytd' } | { kind: 'month'; month: string }

export interface DashboardQuery {
  records: LedgerRecord[]
  businesses: Business[]
  scope: Scope
  mode: LedgerMode
  today: { year: number; month: number; day: number }
  detail: DetailRange
  includePlanned: boolean
  /** 為真時，一次性／以前年度支出不計入支出與淨額。 */
  excludeOneOff: boolean
}

interface Bucket extends Totals {
  categories: Map<string, number>
}

function emptyTotals(): Totals {
  return {
    income: 0,
    otherIncome: 0,
    cash: 0,
    linePay: 0,
    expense: 0,
    refundable: 0,
    plannedExpense: 0,
    plannedRefundable: 0,
    settlements: 0,
    oneOff: 0,
    net: 0,
  }
}

function emptyBucket(): Bucket {
  return { ...emptyTotals(), categories: new Map() }
}

function finalize(bucket: Totals): Totals {
  return { ...bucket, net: bucket.income - bucket.expense }
}

function addTotals(target: Totals, extra: Totals): void {
  target.income += extra.income
  target.otherIncome += extra.otherIncome
  target.cash += extra.cash
  target.linePay += extra.linePay
  target.expense += extra.expense
  target.refundable += extra.refundable
  target.plannedExpense += extra.plannedExpense
  target.plannedRefundable += extra.plannedRefundable
  target.settlements += extra.settlements
  target.oneOff += extra.oneOff
  target.net = target.income - target.expense
}

function inScope(record: LedgerRecord, scope: Scope): boolean {
  return scope === 'all' || record.businessId === scope
}

function methodAmounts(record: LedgerRecord): { method: string; amount: number }[] {
  if (record.splits.length > 0) return record.splits
  if (record.paymentMethod) return [{ method: record.paymentMethod, amount: record.amount }]
  return []
}

function expenseParts(record: LedgerRecord, mode: LedgerMode): { month: string; amount: number }[] {
  if (record.amount === 0) return []
  if (
    mode === 'accrual' &&
    record.periodStart &&
    record.periodEnd
  ) {
    const spread = spreadAmount(record.amount, record.periodStart, record.periodEnd)
    if (spread.length > 1) return spread
  }
  return [{ month: record.accountingMonth, amount: record.amount }]
}

function categoryKey(record: LedgerRecord): string {
  return `${record.businessId}:${record.categoryId}`
}

function categoryLabel(record: LedgerRecord, businesses: Business[], scope: Scope): string {
  const category = findCategory(businesses, record.categoryId)
  const name = category?.name ?? '未分類'
  if (scope !== 'all') return name
  const business = businesses.find((item) => item.id === record.businessId)
  return `${business?.name ?? record.businessId}・${name}`
}

export function startupSummary(records: LedgerRecord[], sharePercent: number | null): StartupSummary {
  let paidSunk = 0
  let paidRefundable = 0
  let plannedSunk = 0
  let plannedRefundable = 0
  const pending: { id: string; note: string }[] = []
  for (const record of records) {
    if (record.businessId !== 'laya' || record.type !== 'expense') continue
    if (record.status === 'paid') {
      if (record.refundable) paidRefundable += record.amount
      else paidSunk += record.amount
      continue
    }
    if (record.refundable) plannedRefundable += record.amount
    else plannedSunk += record.amount
    if (record.amount === 0) pending.push({ id: record.id, note: record.note || '待補金額' })
  }
  const estimatedSunk = paidSunk + plannedSunk
  const refundableAll = paidRefundable + plannedRefundable
  return {
    paidSunk,
    paidRefundable,
    plannedSunk,
    plannedRefundable,
    plannedUnpaid: plannedSunk + plannedRefundable,
    invested: paidSunk + paidRefundable,
    estimatedSunk,
    estimatedAll: estimatedSunk + refundableAll,
    sharePercent,
    shareOfSunk: shareAmount(estimatedSunk, sharePercent),
    shareOfRefundable: shareAmount(refundableAll, sharePercent),
    pending,
  }
}

function monthFacts(
  records: LedgerRecord[],
  scope: Scope,
  businesses: Business[],
  month: string,
  throughDay: number | null,
): MonthFacts {
  const operating = businesses.filter(
    (business) => business.phase === 'operating' && (scope === 'all' || business.id === scope),
  )
  if (operating.length === 0) return { closed: [], gaps: [], missing: [] }
  const ids = new Set(operating.map((business) => business.id))
  const closed: string[] = []
  const gaps: string[] = []
  const covered = new Set<string>()
  for (const record of records) {
    if (!ids.has(record.businessId) || record.type !== 'income') continue
    if (!record.date.startsWith(`${month}-`)) continue
    if (record.gap) {
      gaps.push(record.date)
      continue
    }
    covered.add(record.date)
    if (record.closed) closed.push(record.date)
  }
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const limit = throughDay === null ? last : Math.min(last, throughDay)
  const missing: string[] = []
  for (let day = 1; day <= limit; day += 1) {
    const iso = `${month}-${String(day).padStart(2, '0')}`
    if (!covered.has(iso) && !gaps.includes(iso)) missing.push(iso)
  }
  closed.sort()
  gaps.sort()
  return { closed, gaps, missing }
}

export function buildDashboard(query: DashboardQuery): DashboardModel {
  const { records, businesses, scope, mode, today, detail, includePlanned, excludeOneOff } = query
  const current = monthKeyOf(today.year, today.month)
  const buckets = new Map<string, Bucket>()
  const categoryNames = new Map<string, string>()

  const bucketFor = (month: string): Bucket => {
    const existing = buckets.get(month)
    if (existing) return existing
    const created = emptyBucket()
    buckets.set(month, created)
    return created
  }

  for (const record of records) {
    if (!inScope(record, scope)) continue
    if (record.type === 'income') {
      if (record.closed || record.gap || record.status !== 'paid') continue
      const bucket = bucketFor(record.accountingMonth)
      bucket.income += record.amount
      if (record.categoryId === CAFE_OTHER_INCOME) bucket.otherIncome += record.amount
      for (const split of methodAmounts(record)) {
        if (split.method === CASH_METHOD) bucket.cash += split.amount
        else if (split.method === LINE_PAY_METHOD) bucket.linePay += split.amount
      }
      continue
    }
    if (record.type === 'settlement') {
      if (record.status !== 'paid') continue
      bucketFor(record.accountingMonth).settlements += record.amount
      continue
    }
    if (record.status === 'planned') {
      const bucket = bucketFor(record.accountingMonth)
      if (record.refundable) bucket.plannedRefundable += record.amount
      else bucket.plannedExpense += record.amount
      if (includePlanned && !record.refundable && record.amount > 0) {
        const key = categoryKey(record)
        categoryNames.set(key, categoryLabel(record, businesses, scope))
        bucket.categories.set(key, (bucket.categories.get(key) ?? 0) + record.amount)
      }
      continue
    }
    if (record.refundable) {
      bucketFor(record.accountingMonth).refundable += record.amount
      continue
    }
    const parts = expenseParts(record, mode)
    if (parts.length === 0) continue
    const key = categoryKey(record)
    categoryNames.set(key, categoryLabel(record, businesses, scope))
    for (const part of parts) {
      const bucket = bucketFor(part.month)
      if (record.oneOff) bucket.oneOff += part.amount
      if (record.oneOff && excludeOneOff) continue
      bucket.expense += part.amount
      bucket.categories.set(key, (bucket.categories.get(key) ?? 0) + part.amount)
    }
  }

  const thisBucket = buckets.get(current) ?? emptyBucket()
  const ytd: Totals = emptyTotals()
  for (const [month, bucket] of buckets) {
    if (month.startsWith(`${today.year}-`) && month <= current) addTotals(ytd, bucket)
  }

  let futureAccrual = 0
  for (const [month, bucket] of buckets) {
    if (month > current) futureAccrual += bucket.expense
  }

  const earliest = [...buckets.keys()].filter((month) => month <= current).sort()[0] ?? current
  const months = monthSequence(earliest, current).map((month) => {
    const bucket = buckets.get(month) ?? emptyBucket()
    return { month, ...finalize(bucket) }
  })

  const detailMonths =
    detail.kind === 'ytd'
      ? new Set(months.filter((row) => row.month.startsWith(`${today.year}-`)).map((row) => row.month))
      : new Set([detail.month])

  const detailTotals = emptyTotals()
  const categorySums = new Map<string, number>()
  for (const month of detailMonths) {
    const bucket = buckets.get(month)
    if (!bucket) continue
    addTotals(detailTotals, bucket)
    for (const [key, amount] of bucket.categories) {
      categorySums.set(key, (categorySums.get(key) ?? 0) + amount)
    }
  }

  const categories = [...categorySums.entries()]
    .map(([key, amount]) => ({ key, name: categoryNames.get(key) ?? '未分類', amount }))
    .filter((slice) => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'zh-Hant'))

  const vendorMap = new Map<string, number>()
  let goodsWithoutVendor = 0
  for (const record of records) {
    if (!inScope(record, scope) || record.type !== 'expense') continue
    if (!detailMonths.has(record.accountingMonth)) continue
    if (record.status === 'planned' && !includePlanned) continue
    if (record.status !== 'paid' && record.status !== 'planned') continue
    if (record.refundable || (excludeOneOff && record.oneOff)) continue
    const category = findCategory(businesses, record.categoryId)
    if (record.vendor.trim()) {
      vendorMap.set(record.vendor.trim(), (vendorMap.get(record.vendor.trim()) ?? 0) + record.amount)
    } else if (category?.id === 'cafe-goods' || category?.name === '食材進貨') {
      goodsWithoutVendor += record.amount
    }
  }
  const vendors = [...vendorMap.entries()]
    .map(([vendor, amount]) => ({ vendor, amount }))
    .filter((slice) => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.vendor.localeCompare(b.vendor, 'zh-Hant'))

  const productMap = new Map<string, number>()
  for (const record of records) {
    if (!inScope(record, scope) || record.type !== 'income' || record.closed || record.gap) continue
    if (record.status !== 'paid' || !detailMonths.has(record.accountingMonth)) continue
    const line = record.productLine.trim()
    if (!line) continue
    productMap.set(line, (productMap.get(line) ?? 0) + record.amount)
  }
  const productLines = [...productMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'zh-Hant'))

  const showStartup = scope === 'laya' || scope === 'all'
  const laya = businesses.find((business) => business.id === 'laya')
  const throughCurrent = today.day
  const thisFacts = monthFacts(records, scope, businesses, current, throughCurrent)
  const detailFacts =
    detail.kind === 'month'
      ? monthFacts(
          records,
          scope,
          businesses,
          detail.month,
          detail.month === current ? throughCurrent : detail.month < current ? null : 0,
        )
      : null

  return {
    thisMonth: finalize(thisBucket),
    ytd: finalize(ytd),
    months,
    categories,
    vendors,
    productLines,
    goodsWithoutVendor,
    startup: showStartup ? startupSummary(records, laya?.sharePercent ?? null) : null,
    detail: finalize(detailTotals),
    futureAccrual,
    thisFacts,
    detailFacts,
  }
}
