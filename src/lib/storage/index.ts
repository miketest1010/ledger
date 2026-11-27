import { createIndexedDbRepository } from './indexeddb.ts'
import type { LedgerRepository } from './repository.ts'

let repository: LedgerRepository | null = null

export function getRepository(): LedgerRepository {
  repository ??= createIndexedDbRepository()
  return repository
}

export type { LedgerRepository } from './repository.ts'
