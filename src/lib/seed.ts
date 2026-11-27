import { defaultBusinesses } from './defaults.ts'
import type { LedgerRecord, LedgerSnapshot } from './types.ts'

/**
 * No financial records are bundled. A new browser starts with the two shops
 * and an empty book. Import a `shuangdian-ledger` v1 backup to restore data.
 */
export function buildSeedRecords(): LedgerRecord[] {
  return []
}

export function initialSnapshot(): LedgerSnapshot {
  return {
    businesses: defaultBusinesses(),
    records: [],
    settings: { schemaVersion: 1, seedCleared: true },
  }
}

export function withoutSeed(snapshot: LedgerSnapshot): LedgerSnapshot {
  return {
    ...snapshot,
    records: snapshot.records.filter((record) => !record.seed),
    settings: { ...snapshot.settings, seedCleared: true },
  }
}

/** Reloading starter data is a no-op. Nothing is inserted. */
export function withSeedRestored(snapshot: LedgerSnapshot): LedgerSnapshot {
  return snapshot
}
