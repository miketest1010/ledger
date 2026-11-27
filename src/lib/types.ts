export type BusinessId = 'cafe' | 'laya'
export type EntryType = 'income' | 'expense' | 'settlement'
export type EntryStatus = 'paid' | 'planned'
export type CategoryKind = 'income' | 'expense' | 'settlement'
export type Scope = BusinessId | 'all'
export type LedgerMode = 'accounting' | 'accrual'

export const CASH_METHOD = '現金'
export const LINE_PAY_METHOD = 'Line Pay'
export const PAYMENT_METHODS = [CASH_METHOD, LINE_PAY_METHOD, '轉帳', '信用卡', '行動支付'] as const

export interface Category {
  id: string
  name: string
  kind: CategoryKind
}

export interface Business {
  id: BusinessId
  name: string
  englishName: string
  place: string
  phase: 'operating' | 'preopening'
  description: string
  sharePercent: number | null
  startup: boolean
  categories: Category[]
}

export interface PaymentSplit {
  method: string
  amount: number
}

export interface LedgerRecord {
  id: string
  businessId: BusinessId
  /** 付款日或營業日，YYYY-MM-DD，以台北日期理解。 */
  date: string
  /** 帳務月份 YYYY-MM。儀表板預設依這個月份，不依付款日。 */
  accountingMonth: string
  type: EntryType
  categoryId: string
  /**
   * 整數新台幣。有收款拆分時等於拆分合計。
   * 若填了未稅與稅額，這是含稅價，等於兩者相加。
   */
  amount: number
  /** 未稅金額。沒填就是 null。 */
  preTax: number | null
  /**
   * 稅額。收入是銷項稅額，支出是進項稅額。沒填就是 null。
   * 2026 年 11 月起諾奇意開統一發票，稅率 5%。
   */
  tax: number | null
  note: string
  paymentMethod: string
  splits: PaymentSplit[]
  vendor: string
  /** 產品線，例如寵物蛋糕。空字串表示沒有。 */
  productLine: string
  refundable: boolean
  status: EntryStatus
  periodStart: string | null
  periodEnd: string | null
  /** 公休。不計入營收。 */
  closed: boolean
  /** 來源沒有這一天。不計入營收，用來標出待補的日期。 */
  gap: boolean
  /** 以前年度或一次性，可從營業觀點排除。 */
  oneOff: boolean
  seed: boolean
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  schemaVersion: 1
  seedCleared: boolean
}

export interface LedgerSnapshot {
  businesses: Business[]
  records: LedgerRecord[]
  settings: AppSettings
}

export const TYPE_LABEL: Record<EntryType, string> = {
  income: '收入',
  expense: '支出',
  settlement: '撥款',
}

export const STATUS_LABEL: Record<EntryStatus, string> = {
  paid: '已付款',
  planned: '計畫中',
}

export function kindForType(type: EntryType): CategoryKind {
  return type
}
