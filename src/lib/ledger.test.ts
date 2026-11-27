import { describe, expect, it } from 'vitest'
import { spreadAmount } from './accrual.ts'
import { buildDashboard } from './aggregate.ts'
import { parseBackup, serializeBackup } from './backup.ts'
import { importCsv, recordsToCsv } from './csv.ts'
import { defaultBusinesses } from './defaults.ts'
import { formatTwd, shareAmount } from './money.ts'
import { buildSeedRecords, initialSnapshot } from './seed.ts'
import type { LedgerRecord, LedgerSnapshot } from './types.ts'
import { cafeExpenseIncomplete, estimateCafeVat, INCOMPLETE_EXPENSE_NOTE, splitInclusiveVat } from './vat.ts'

const today = { year: 2026, month: 11, day: 27 }
const stamp = '2026-11-01T02:00:00.000+08:00'

function record(partial: Pick<LedgerRecord, 'id' | 'businessId' | 'type' | 'categoryId' | 'amount'> & Partial<LedgerRecord>): LedgerRecord {
  return {
    date: '2026-11-08',
    accountingMonth: '2026-11',
    preTax: null,
    tax: null,
    note: '',
    paymentMethod: '現金',
    splits: [],
    vendor: '',
    productLine: '',
    refundable: false,
    status: 'paid',
    periodStart: null,
    periodEnd: null,
    closed: false,
    gap: false,
    oneOff: false,
    seed: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  }
}

const sampleRecords: LedgerRecord[] = [
  record({
    id: 'sale-1',
    businessId: 'cafe',
    type: 'income',
    categoryId: 'cafe-revenue',
    amount: 210,
    splits: [
      { method: '現金', amount: 80 },
      { method: 'Line Pay', amount: 130 },
    ],
    paymentMethod: '',
  }),
  record({
    id: 'other-1',
    businessId: 'cafe',
    type: 'income',
    categoryId: 'cafe-other-income',
    amount: 40,
    productLine: '樣例產品',
    note: '其他收入',
  }),
  record({
    id: 'goods-1',
    businessId: 'cafe',
    type: 'expense',
    categoryId: 'cafe-goods',
    amount: 70,
    vendor: '樣例供應商',
    preTax: 67,
    tax: 3,
  }),
  record({
    id: 'goods-2',
    businessId: 'cafe',
    type: 'expense',
    categoryId: 'cafe-goods',
    amount: 15,
  }),
  record({
    id: 'one-off-1',
    businessId: 'cafe',
    type: 'expense',
    categoryId: 'cafe-tax',
    amount: 25,
    oneOff: true,
    note: '一次性',
  }),
  record({
    id: 'deposit-1',
    businessId: 'cafe',
    type: 'settlement',
    categoryId: 'cafe-settlement',
    amount: 90,
    paymentMethod: 'Line Pay',
  }),
  record({
    id: 'power-1',
    businessId: 'cafe',
    type: 'expense',
    categoryId: 'cafe-utilities',
    amount: 62,
    accountingMonth: '2026-11',
    date: '2026-11-10',
    periodStart: '2026-08-01',
    periodEnd: '2026-09-30',
    note: '跨月水電',
  }),
  record({
    id: 'laya-paid',
    businessId: 'laya',
    type: 'expense',
    categoryId: 'laya-rent',
    amount: 30,
    note: '已付',
  }),
  record({
    id: 'laya-planned',
    businessId: 'laya',
    type: 'expense',
    categoryId: 'laya-franchise',
    amount: 50,
    status: 'planned',
    note: '預計',
  }),
  record({
    id: 'laya-refundable',
    businessId: 'laya',
    type: 'expense',
    categoryId: 'laya-deposit',
    amount: 20,
    status: 'planned',
    refundable: true,
    note: '可退',
  }),
]

function dashboard(
  records: LedgerRecord[],
  scope: 'cafe' | 'laya' | 'all',
  mode: 'accounting' | 'accrual' = 'accounting',
  detail: { kind: 'ytd' } | { kind: 'month'; month: string } = { kind: 'month', month: '2026-11' },
  excludeOneOff = false,
) {
  return buildDashboard({
    records,
    businesses: defaultBusinesses(),
    scope,
    mode,
    today,
    detail,
    includePlanned: false,
    excludeOneOff,
  })
}

describe('empty books', () => {
  it('formats whole TWD with thousands separators', () => {
    expect(formatTwd(1234567)).toBe('1,234,567')
    expect(formatTwd(0)).toBe('0')
    expect(formatTwd(-20000)).toBe('−20,000')
  })

  it('starts with the two shops and no records', () => {
    expect(buildSeedRecords()).toEqual([])
    const snapshot = initialSnapshot()
    expect(snapshot.records).toEqual([])
    expect(snapshot.settings).toEqual({ schemaVersion: 1, seedCleared: true })
    expect(snapshot.businesses.map((business) => business.name)).toEqual(['諾奇意咖啡', '拉亞漢堡 新莊店'])
    expect(snapshot.businesses.find((business) => business.id === 'laya')?.sharePercent).toBeNull()
  })

  it('keeps a blank month at zero and ignores Line Pay deposits as revenue', () => {
    const blank = dashboard([], 'cafe')
    expect(blank.detail.income).toBe(0)
    expect(blank.detail.expense).toBe(0)
    expect(blank.detail.net).toBe(0)

    const books = dashboard(sampleRecords, 'cafe')
    expect(books.detail.income).toBe(250)
    expect(books.detail.otherIncome).toBe(40)
    expect(books.detail.cash).toBe(120)
    expect(books.detail.linePay).toBe(130)
    expect(books.detail.settlements).toBe(90)
    expect(books.detail.expense).toBe(172)
    expect(books.detail.oneOff).toBe(25)
    expect(books.detail.net).toBe(250 - 172)
    expect(books.detail.income).not.toBe(books.detail.income + books.detail.settlements)
    expect(books.vendors).toEqual([{ vendor: '樣例供應商', amount: 70 }])
    expect(books.goodsWithoutVendor).toBe(15)
    expect(books.productLines).toEqual([{ name: '樣例產品', amount: 40 }])
  })

  it('can leave one-off expenses out of the operating view', () => {
    const operating = dashboard(sampleRecords, 'cafe', 'accounting', { kind: 'month', month: '2026-11' }, true)
    expect(operating.detail.expense).toBe(172 - 25)
    expect(operating.detail.oneOff).toBe(25)
    expect(operating.categories.find((slice) => slice.name === '稅務')).toBeUndefined()
  })

  it('spreads a full two-month period evenly in the accrual view', () => {
    expect(spreadAmount(62, '2026-08-01', '2026-09-30')).toEqual([
      { month: '2026-08', amount: 31 },
      { month: '2026-09', amount: 31 },
    ])
    const accrual = dashboard(sampleRecords, 'cafe', 'accrual')
    expect(accrual.detail.expense).toBe(172 - 62)
    const august = dashboard(sampleRecords, 'cafe', 'accrual', { kind: 'month', month: '2026-08' })
    expect(august.detail.expense).toBe(31)
  })

  it('summarizes Laya startup costs and leaves the share blank', () => {
    const laya = dashboard(sampleRecords, 'laya', 'accounting', { kind: 'ytd' })
    expect(laya.startup?.invested).toBe(30)
    expect(laya.startup?.plannedUnpaid).toBe(70)
    expect(laya.startup?.plannedRefundable).toBe(20)
    expect(laya.startup?.estimatedSunk).toBe(80)
    expect(laya.startup?.sharePercent).toBeNull()
    expect(laya.startup?.shareOfSunk).toBeNull()
    expect(shareAmount(80, 50)).toBe(40)
    expect(shareAmount(80, null)).toBeNull()
  })
})

describe('café tax flags', () => {
  it('marks café months before November 2026 as incomplete expenses', () => {
    expect(INCOMPLETE_EXPENSE_NOTE).toBe('支出不完整，僅供參考')
    expect(cafeExpenseIncomplete('2026-10', 'cafe')).toBe(true)
    expect(cafeExpenseIncomplete('2026-10', 'all')).toBe(true)
    expect(cafeExpenseIncomplete('2026-11', 'cafe')).toBe(false)
    expect(cafeExpenseIncomplete('2026-10', 'laya')).toBe(false)
  })

  it('estimates output VAT from a tax-inclusive sale', () => {
    expect(splitInclusiveVat(105).tax).toBe(5)
    expect(splitInclusiveVat(105).preTax).toBe(100)
    const [period] = estimateCafeVat(sampleRecords, '2026-11')
    const estimated = splitInclusiveVat(210).tax + splitInclusiveVat(40).tax
    expect(period?.label).toBe('2026年11–12月')
    expect(period?.outputEstimated).toBe(estimated)
    expect(period?.input).toBe(3)
    expect(period?.payable).toBe(estimated - 3)
  })
})

describe('backup files', () => {
  function sampleSnapshot(): LedgerSnapshot {
    return {
      ...initialSnapshot(),
      records: sampleRecords,
    }
  }

  it('round-trips JSON and CSV without dropping splits or periods', () => {
    const snapshot = sampleSnapshot()
    const parsed = parseBackup(serializeBackup(snapshot))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.snapshot.records).toHaveLength(snapshot.records.length)
    const sale = parsed.snapshot.records.find((item) => item.id === 'sale-1')
    expect(sale?.splits).toEqual([
      { method: '現金', amount: 80 },
      { method: 'Line Pay', amount: 130 },
    ])
    const power = parsed.snapshot.records.find((item) => item.id === 'power-1')
    expect(power?.periodStart).toBe('2026-08-01')
    expect(power?.periodEnd).toBe('2026-09-30')
    expect(power?.amount).toBe(62)

    const csv = recordsToCsv(snapshot)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const imported = importCsv(csv, snapshot)
    expect(imported.errors).toEqual([])
    expect(imported.records).toHaveLength(snapshot.records.length)
    expect(imported.records.find((item) => item.id === 'sale-1')?.splits).toEqual(sale?.splits)
    expect(imported.records.find((item) => item.id === 'power-1')?.periodStart).toBe('2026-08-01')
  })

  it('accepts only shuangdian-ledger version 1', () => {
    const snapshot = sampleSnapshot()
    const raw = JSON.parse(serializeBackup(snapshot)) as { format: string; version: number }
    expect(raw.format).toBe('shuangdian-ledger')
    expect(raw.version).toBe(1)
    expect(parseBackup('{"format":"other","version":1}').ok).toBe(false)
    expect(parseBackup('not json').ok).toBe(false)
  })
})
