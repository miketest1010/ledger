import type { Business, LedgerRecord, LedgerSnapshot } from '../types.ts'

/**
 * 帳簿儲存介面。現在只有瀏覽器裡的 IndexedDB。
 * 之後若要加同步後端，實作這個介面即可，畫面不用改。
 */
export interface LedgerRepository {
  load(): Promise<LedgerSnapshot>
  saveRecord(record: LedgerRecord): Promise<void>
  deleteRecord(id: string): Promise<void>
  saveBusiness(business: Business): Promise<void>
  replaceAll(snapshot: LedgerSnapshot): Promise<void>
  clearSeed(): Promise<number>
  restoreSeed(): Promise<number>
}
