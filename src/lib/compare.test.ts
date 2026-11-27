import { describe, expect, it } from 'vitest'
import { compareMonths, monthDelta } from './compare.ts'
import { defaultBusinesses } from './defaults.ts'
import { accountingMonths, adjacentMonth } from './months.ts'
import type { LedgerRecord } from './types.ts'

const stamp = '2026-10-01T02:00:00.000+08:00'

function rec(
  partial: Pick<LedgerRecord, 'id' | 'businessId' | 'type' | 'categoryId' | 'amount' | 'accountingMonth'> &
    Partial<LedgerRecord>,
): LedgerRecord {
  return {
    date: `${partial.accountingMonth}-02`,
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

const businesses = defaultBusinesses()

describe('accounting months', () => {
  const records = [
    rec({ id: 'a', businessId: 'cafe', type: 'income', categoryId: 'cafe-revenue', amount: 10, accountingMonth: '2026-10' }),
    rec({ id: 'b', businessId: 'cafe', type: 'expense', categoryId: 'cafe-goods', amount: 4, accountingMonth: '2026-12' }),
    rec({ id: 'c', businessId: 'laya', type: 'expense', categoryId: 'laya-rent', amount: 6, accountingMonth: '2026-11' }),
  ]

  it('lists months that have records, newest first, for one store or all of them', () => {
    expect(accountingMonths(records, 'cafe')).toEqual(['2026-12', '2026-10'])
    expect(accountingMonths(records, 'laya')).toEqual(['2026-11'])
    expect(accountingMonths(records, 'all')).toEqual(['2026-12', '2026-11', '2026-10'])
  })

  it('steps older and newer without walking past the ends', () => {
    const months = accountingMonths(records, 'all')
    expect(adjacentMonth(months, '2026-11', 'older')).toBe('2026-10')
    expect(adjacentMonth(months, '2026-11', 'newer')).toBe('2026-12')
    expect(adjacentMonth(months, '2026-12', 'newer')).toBeNull()
    expect(adjacentMonth(months, '2026-10', 'older')).toBeNull()
    expect(adjacentMonth(months, 'ytd', 'older')).toBe('2026-12')
    expect(adjacentMonth(months, 'ytd', 'newer')).toBeNull()
  })
})

describe('month comparison', () => {
  const records = [
    rec({ id: 'oct-sale', businessId: 'cafe', type: 'income', categoryId: 'cafe-revenue', amount: 200, accountingMonth: '2026-10' }),
    rec({ id: 'nov-sale', businessId: 'cafe', type: 'income', categoryId: 'cafe-revenue', amount: 300, accountingMonth: '2026-11' }),
    rec({ id: 'oct-goods', businessId: 'cafe', type: 'expense', categoryId: 'cafe-goods', amount: 80, accountingMonth: '2026-10' }),
    rec({ id: 'nov-goods', businessId: 'cafe', type: 'expense', categoryId: 'cafe-goods', amount: 50, accountingMonth: '2026-11' }),
    rec({
      id: 'nov-plan',
      businessId: 'cafe',
      type: 'expense',
      categoryId: 'cafe-rent',
      amount: 40,
      accountingMonth: '2026-11',
      status: 'planned',
    }),
    rec({
      id: 'nov-plan-income',
      businessId: 'cafe',
      type: 'income',
      categoryId: 'cafe-other-income',
      amount: 15,
      accountingMonth: '2026-11',
      status: 'planned',
    }),
    rec({
      id: 'refund',
      businessId: 'laya',
      type: 'expense',
      categoryId: 'laya-deposit',
      amount: 999,
      accountingMonth: '2026-11',
      refundable: true,
    }),
    rec({
      id: 'payout',
      businessId: 'cafe',
      type: 'settlement',
      categoryId: 'cafe-settlement',
      amount: 500,
      accountingMonth: '2026-11',
    }),
    rec({
      id: 'closed',
      businessId: 'cafe',
      type: 'income',
      categoryId: 'cafe-revenue',
      amount: 70,
      accountingMonth: '2026-11',
      closed: true,
    }),
    rec({ id: 'laya-rent', businessId: 'laya', type: 'expense', categoryId: 'laya-rent', amount: 30, accountingMonth: '2026-11' }),
  ]

  it('compares paid income, expense, net, and categories, and leaves the other figures out', () => {
    const model = compareMonths({ records, businesses, scope: 'cafe', months: ['2026-11', '2026-10'] })
    expect(model.months).toEqual(['2026-10', '2026-11'])
    expect(model.income.map((cell) => cell.paid)).toEqual([200, 300])
    expect(model.expense.map((cell) => cell.paid)).toEqual([80, 50])
    expect(model.net.map((cell) => cell.paid)).toEqual([120, 250])
    expect(model.expense.map((cell) => cell.planned)).toEqual([0, 40])
    expect(model.income.map((cell) => cell.planned)).toEqual([0, 15])
    expect(model.categories.find((row) => row.name === '食材進貨')?.amounts.map((cell) => cell.paid)).toEqual([80, 50])
    expect(model.categories.some((row) => row.name.includes('撥款'))).toBe(false)
    expect(monthDelta(300, 200)).toEqual({ difference: 100, percent: 50 })
    expect(monthDelta(50, 80)).toEqual({ difference: -30, percent: -37.5 })
    expect(monthDelta(15, 0)).toEqual({ difference: 15, percent: null })
  })

  it('keeps the other store out unless the scope is all', () => {
    const cafe = compareMonths({ records, businesses, scope: 'cafe', months: ['2026-11'] })
    const all = compareMonths({ records, businesses, scope: 'all', months: ['2026-11'] })
    expect(cafe.expense[0]?.paid).toBe(50)
    expect(all.expense[0]?.paid).toBe(80)
    expect(all.categories.some((row) => row.name.startsWith('拉亞'))).toBe(true)
  })
})
