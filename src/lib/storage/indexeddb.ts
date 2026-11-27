import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { initialSnapshot, withSeedRestored, withoutSeed } from '../seed.ts'
import type { AppSettings, Business, LedgerRecord, LedgerSnapshot } from '../types.ts'
import type { LedgerRepository } from './repository.ts'

interface MetaRow {
  key: string
  value: AppSettings
}

interface LedgerSchema extends DBSchema {
  businesses: { key: string; value: Business }
  records: { key: string; value: LedgerRecord }
  meta: { key: string; value: MetaRow }
}

const SETTINGS_KEY = 'settings'

type LedgerDb = IDBPDatabase<LedgerSchema>

async function readSnapshot(db: LedgerDb): Promise<LedgerSnapshot | null> {
  const businesses = (await db.getAll('businesses')) as Business[]
  if (businesses.length === 0) return null
  const records = (await db.getAll('records')) as LedgerRecord[]
  const meta = (await db.get('meta', SETTINGS_KEY)) as MetaRow | undefined
  return {
    businesses,
    records,
    settings: meta?.value ?? { schemaVersion: 1, seedCleared: false },
  }
}

async function writeSnapshot(db: LedgerDb, snapshot: LedgerSnapshot): Promise<void> {
  const tx = db.transaction(['businesses', 'records', 'meta'], 'readwrite')
  await Promise.all([
    tx.objectStore('businesses').clear(),
    tx.objectStore('records').clear(),
    tx.objectStore('meta').clear(),
  ])
  for (const business of snapshot.businesses) await tx.objectStore('businesses').put(business)
  for (const record of snapshot.records) await tx.objectStore('records').put(record)
  await tx.objectStore('meta').put({ key: SETTINGS_KEY, value: snapshot.settings } satisfies MetaRow)
  await tx.done
}

export function createIndexedDbRepository(name = 'shuangdian-ledger'): LedgerRepository {
  const opening = openDB<LedgerSchema>(name, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('businesses')) db.createObjectStore('businesses', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
    },
  })

  return {
    async load() {
      const db = await opening
      const existing = await readSnapshot(db)
      if (existing) return structuredClone(existing)
      const seeded = initialSnapshot()
      await writeSnapshot(db, seeded)
      return structuredClone(seeded)
    },
    async saveRecord(record) {
      const db = await opening
      await db.put('records', record)
    },
    async deleteRecord(id) {
      const db = await opening
      await db.delete('records', id)
    },
    async saveBusiness(business) {
      const db = await opening
      await db.put('businesses', business)
    },
    async replaceAll(snapshot) {
      const db = await opening
      await writeSnapshot(db, snapshot)
    },
    async clearSeed() {
      const db = await opening
      const current = await readSnapshot(db)
      if (!current) return 0
      const removed = current.records.filter((record) => record.seed).length
      await writeSnapshot(db, withoutSeed(current))
      return removed
    },
    async restoreSeed() {
      const db = await opening
      const current = (await readSnapshot(db)) ?? initialSnapshot()
      const before = current.records.length
      const next = withSeedRestored(current)
      await writeSnapshot(db, next)
      return next.records.length - before
    },
  }
}
