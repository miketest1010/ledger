import { initialSnapshot, withSeedRestored, withoutSeed } from '../seed.ts'
import type { Business, LedgerRecord, LedgerSnapshot } from '../types.ts'
import type { LedgerRepository } from './repository.ts'

export function createMemoryRepository(seed: LedgerSnapshot | null = null): LedgerRepository {
  let snapshot: LedgerSnapshot | null = seed ? structuredClone(seed) : null

  async function load(): Promise<LedgerSnapshot> {
    snapshot ??= initialSnapshot()
    return structuredClone(snapshot)
  }

  function commit(next: LedgerSnapshot): void {
    snapshot = structuredClone(next)
  }

  return {
    load,
    async saveRecord(record: LedgerRecord) {
      const current = await load()
      const index = current.records.findIndex((item) => item.id === record.id)
      if (index >= 0) current.records[index] = record
      else current.records.push(record)
      commit(current)
    },
    async deleteRecord(id: string) {
      const current = await load()
      current.records = current.records.filter((item) => item.id !== id)
      commit(current)
    },
    async saveBusiness(business: Business) {
      const current = await load()
      const index = current.businesses.findIndex((item) => item.id === business.id)
      if (index >= 0) current.businesses[index] = business
      else current.businesses.push(business)
      commit(current)
    },
    async replaceAll(next: LedgerSnapshot) {
      commit(next)
    },
    async clearSeed() {
      const current = await load()
      const removed = current.records.filter((record) => record.seed).length
      commit(withoutSeed(current))
      return removed
    },
    async restoreSeed() {
      const current = await load()
      const before = current.records.length
      const next = withSeedRestored(current)
      commit(next)
      return next.records.length - before
    },
  }
}
