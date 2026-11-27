import { isMonthKey, parseISODate } from './dates.ts'
import type {
  AppSettings,
  Business,
  BusinessId,
  EntryStatus,
  EntryType,
  LedgerRecord,
  LedgerSnapshot,
  PaymentSplit,
} from './types.ts'

export interface BackupFile {
  format: 'shuangdian-ledger'
  version: 1
  exportedAt: string
  businesses: Business[]
  records: LedgerRecord[]
  settings: AppSettings
}

const TYPES = new Set<EntryType>(['income', 'expense', 'settlement'])
const STATUSES = new Set<EntryStatus>(['paid', 'planned'])
const BUSINESSES = new Set<BusinessId>(['cafe', 'laya'])

export function serializeBackup(snapshot: LedgerSnapshot, now = new Date()): string {
  const file: BackupFile = {
    format: 'shuangdian-ledger',
    version: 1,
    exportedAt: now.toISOString(),
    businesses: snapshot.businesses,
    records: snapshot.records,
    settings: snapshot.settings,
  }
  return JSON.stringify(file, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' ? value : null
}

function boolField(source: Record<string, unknown>, key: string, fallback: boolean): boolean | null {
  const value = source[key]
  if (value === undefined) return fallback
  return typeof value === 'boolean' ? value : null
}

function optionalMoney(value: unknown): number | null | 'bad' {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  return 'bad'
}

function splitsField(value: unknown): PaymentSplit[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const splits: PaymentSplit[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    if (typeof item.method !== 'string' || !item.method.trim()) return null
    if (typeof item.amount !== 'number' || !Number.isSafeInteger(item.amount) || item.amount < 0) return null
    splits.push({ method: item.method, amount: item.amount })
  }
  return splits
}

function parseRecord(value: unknown, index: number): LedgerRecord | string {
  if (!isRecord(value)) return `第 ${index + 1} 筆紀錄不是物件`
  const id = stringField(value, 'id')
  const businessId = stringField(value, 'businessId')
  const date = stringField(value, 'date')
  const accountingMonth = stringField(value, 'accountingMonth')
  const type = stringField(value, 'type')
  const categoryId = stringField(value, 'categoryId')
  const note = stringField(value, 'note') ?? ''
  const paymentMethod = stringField(value, 'paymentMethod') ?? ''
  const vendor = stringField(value, 'vendor') ?? ''
  const productLine = stringField(value, 'productLine') ?? ''
  const createdAt = stringField(value, 'createdAt') ?? new Date().toISOString()
  const updatedAt = stringField(value, 'updatedAt') ?? createdAt
  if (!id || !businessId || !date || !accountingMonth || !type || !categoryId) {
    return `第 ${index + 1} 筆紀錄缺少必要欄位`
  }
  if (!BUSINESSES.has(businessId as BusinessId)) return `第 ${index + 1} 筆紀錄的店別不對`
  if (!TYPES.has(type as EntryType)) return `第 ${index + 1} 筆紀錄的類型不對`
  if (!parseISODate(date)) return `第 ${index + 1} 筆紀錄的日期不對`
  if (!isMonthKey(accountingMonth)) return `第 ${index + 1} 筆紀錄的帳務月份不對`
  if (typeof value.amount !== 'number' || !Number.isSafeInteger(value.amount) || value.amount < 0) {
    return `第 ${index + 1} 筆紀錄的金額要是整數`
  }
  const statusValue = stringField(value, 'status') ?? 'paid'
  if (!STATUSES.has(statusValue as EntryStatus)) return `第 ${index + 1} 筆紀錄的狀態不對`
  const splits = splitsField(value.splits)
  if (!splits) return `第 ${index + 1} 筆紀錄的收款拆分不對`
  if (splits.length > 0 && splits.reduce((sum, split) => sum + split.amount, 0) !== value.amount) {
    return `第 ${index + 1} 筆紀錄的收款拆分合計不等於金額`
  }
  const refundable = boolField(value, 'refundable', false)
  const closed = boolField(value, 'closed', false)
  const gap = boolField(value, 'gap', false)
  const oneOff = boolField(value, 'oneOff', false)
  const seed = boolField(value, 'seed', false)
  if (refundable === null || closed === null || gap === null || oneOff === null || seed === null) {
    return `第 ${index + 1} 筆紀錄有看不懂的是／否欄位`
  }
  const periodStart = value.periodStart === null || value.periodStart === undefined ? null : stringField(value, 'periodStart')
  const periodEnd = value.periodEnd === null || value.periodEnd === undefined ? null : stringField(value, 'periodEnd')
  if (periodStart === null && value.periodStart) return `第 ${index + 1} 筆紀錄的期間起不對`
  if (periodEnd === null && value.periodEnd) return `第 ${index + 1} 筆紀錄的期間迄不對`
  if ((periodStart && !parseISODate(periodStart)) || (periodEnd && !parseISODate(periodEnd))) {
    return `第 ${index + 1} 筆紀錄的期間日期不對`
  }
  const preTax = optionalMoney(value.preTax)
  const tax = optionalMoney(value.tax)
  if (preTax === 'bad' || tax === 'bad') return `第 ${index + 1} 筆紀錄的未稅金額或稅額不對`
  if ((preTax === null) !== (tax === null)) return `第 ${index + 1} 筆紀錄的未稅金額和稅額要一起填`
  if (preTax !== null && tax !== null && preTax + tax !== value.amount) {
    return `第 ${index + 1} 筆紀錄的未稅金額加稅額要等於含稅金額`
  }
  return {
    id,
    businessId: businessId as BusinessId,
    date,
    accountingMonth,
    type: type as EntryType,
    categoryId,
    amount: value.amount,
    preTax,
    tax,
    note,
    paymentMethod,
    splits,
    vendor,
    productLine,
    refundable,
    status: statusValue as EntryStatus,
    periodStart,
    periodEnd,
    closed,
    gap,
    oneOff,
    seed,
    createdAt,
    updatedAt,
  }
}

export function parseBackup(text: string): { ok: true; snapshot: LedgerSnapshot } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '這不是一份 JSON 檔' }
  }
  if (!isRecord(raw) || raw.format !== 'shuangdian-ledger' || raw.version !== 1) {
    return { ok: false, error: '這不是雙店帳簿的備份檔（版本 1）' }
  }
  if (!Array.isArray(raw.businesses) || !Array.isArray(raw.records) || !isRecord(raw.settings)) {
    return { ok: false, error: '備份檔缺少店別、紀錄或設定' }
  }
  const businesses = raw.businesses as Business[]
  if (!businesses.some((business) => business?.id === 'cafe') || !businesses.some((business) => business?.id === 'laya')) {
    return { ok: false, error: '備份檔要同時包含諾奇意咖啡和拉亞漢堡' }
  }
  const records: LedgerRecord[] = []
  for (let index = 0; index < raw.records.length; index += 1) {
    const parsed = parseRecord(raw.records[index], index)
    if (typeof parsed === 'string') return { ok: false, error: parsed }
    records.push(parsed)
  }
  const settings = raw.settings
  if (settings.schemaVersion !== 1 || typeof settings.seedCleared !== 'boolean') {
    return { ok: false, error: '備份檔的設定不對' }
  }
  return {
    ok: true,
    snapshot: {
      businesses,
      records,
      settings: { schemaVersion: 1, seedCleared: settings.seedCleared },
    },
  }
}
