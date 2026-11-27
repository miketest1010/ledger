import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createIndexedDbRepository } from './indexeddb.ts'
import { createMemoryRepository } from './memory.ts'
import type { LedgerRepository } from './repository.ts'
import type { LedgerRecord } from '../types.ts'

function userRecord(id: string, seed: boolean): LedgerRecord {
  return {
    id,
    businessId: 'cafe',
    date: '2026-11-27',
    accountingMonth: '2026-11',
    type: 'expense',
    categoryId: 'cafe-misc',
    amount: seed ? 10 : 80,
    preTax: null,
    tax: null,
    note: seed ? '標記' : '測試雜支',
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
    seed,
    createdAt: '2026-11-27T02:00:00.000+08:00',
    updatedAt: '2026-11-27T02:00:00.000+08:00',
  }
}

async function behaves(repo: LedgerRepository) {
  const first = await repo.load()
  expect(first.records).toEqual([])
  expect(first.businesses.map((business) => business.name)).toEqual(['諾奇意咖啡', '拉亞漢堡 新莊店'])
  expect(first.settings.seedCleared).toBe(true)
  const again = await repo.load()
  expect(again.records).toHaveLength(0)

  const custom = userRecord('rec-user-1', false)
  await repo.saveRecord(custom)
  custom.note = '測試雜支已改'
  custom.amount = 120
  await repo.saveRecord(custom)
  const saved = await repo.load()
  expect(saved.records.find((record) => record.id === 'rec-user-1')).toMatchObject({ amount: 120, note: '測試雜支已改' })

  expect(await repo.clearSeed()).toBe(0)
  expect((await repo.load()).records.map((record) => record.id)).toEqual(['rec-user-1'])

  expect(await repo.restoreSeed()).toBe(0)
  expect((await repo.load()).records).toHaveLength(1)

  await repo.saveRecord(userRecord('rec-flagged', true))
  expect(await repo.clearSeed()).toBe(1)
  const cleared = await repo.load()
  expect(cleared.records.map((record) => record.id)).toEqual(['rec-user-1'])
  expect(cleared.settings.seedCleared).toBe(true)
  expect(await repo.restoreSeed()).toBe(0)
  expect((await repo.load()).records.some((record) => record.seed)).toBe(false)

  await repo.deleteRecord('rec-user-1')
  const deleted = await repo.load()
  expect(deleted.records.some((record) => record.id === 'rec-user-1')).toBe(false)
}

describe('ledger repository', () => {
  it('keeps records in memory and does not insert starter books', async () => {
    await behaves(createMemoryRepository())
  })

  it('keeps records in IndexedDB across repository instances', async () => {
    const name = `ledger-test-${crypto.randomUUID()}`
    await behaves(createIndexedDbRepository(name))
    const reopened = createIndexedDbRepository(name)
    const loaded = await reopened.load()
    expect(loaded.records).toEqual([])
    expect(loaded.records.some((record) => record.seed)).toBe(false)
    expect(loaded.businesses).toHaveLength(2)
  })
})
