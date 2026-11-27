import { findBusiness } from './defaults.ts'
import { isMonthKey, parseISODate } from './dates.ts'
import { newId } from './utils.ts'
import type { EntryStatus, EntryType, LedgerRecord, LedgerSnapshot, PaymentSplit } from './types.ts'

export const CSV_HEADERS = [
  '編號',
  '店別',
  '付款日期',
  '帳務月份',
  '類型',
  '分類',
  '金額',
  '未稅金額',
  '稅額',
  '收款拆分',
  '廠商',
  '產品線',
  '付款方式',
  '可退押金',
  '狀態',
  '期間起',
  '期間迄',
  '公休',
  '缺漏',
  '一次性',
  '備註',
  '起始資料',
] as const

const TYPE_TO_LABEL: Record<EntryType, string> = {
  income: '收入',
  expense: '支出',
  settlement: '撥款',
}

const LABEL_TO_TYPE: Record<string, EntryType> = {
  收入: 'income',
  支出: 'expense',
  撥款: 'settlement',
}

const STATUS_TO_LABEL: Record<EntryStatus, string> = {
  paid: '已付款',
  planned: '計畫中',
}

const LABEL_TO_STATUS: Record<string, EntryStatus> = {
  已付款: 'paid',
  計畫中: 'planned',
}

function yesNo(value: boolean): string {
  return value ? '是' : '否'
}

function csvEscape(value: string): string {
  let safe = value
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`
  return safe
}

export function formatSplits(splits: PaymentSplit[]): string {
  return splits.map((split) => `${split.method}=${split.amount}`).join(';')
}

export function parseSplits(text: string): PaymentSplit[] | null {
  const trimmed = text.trim()
  if (!trimmed) return []
  const splits: PaymentSplit[] = []
  for (const part of trimmed.split(';')) {
    const piece = part.trim()
    if (!piece) continue
    const eq = piece.lastIndexOf('=')
    if (eq <= 0) return null
    const method = piece.slice(0, eq).trim()
    const amount = Number(piece.slice(eq + 1).replace(/,/g, '').trim())
    if (!method || !Number.isSafeInteger(amount) || amount < 0) return null
    splits.push({ method, amount })
  }
  return splits
}

export function recordsToCsv(snapshot: LedgerSnapshot): string {
  const lines = [CSV_HEADERS.join(',')]
  const records = [...snapshot.records].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  for (const record of records) {
    const business = findBusiness(snapshot.businesses, record.businessId)
    const category = business?.categories.find((item) => item.id === record.categoryId)
    const cells = [
      record.id,
      business?.name ?? record.businessId,
      record.date,
      record.accountingMonth,
      TYPE_TO_LABEL[record.type],
      category?.name ?? record.categoryId,
      String(record.amount),
      record.preTax === null ? '' : String(record.preTax),
      record.tax === null ? '' : String(record.tax),
      formatSplits(record.splits),
      record.vendor,
      record.productLine,
      record.paymentMethod,
      yesNo(record.refundable),
      STATUS_TO_LABEL[record.status],
      record.periodStart ?? '',
      record.periodEnd ?? '',
      yesNo(record.closed),
      yesNo(record.gap),
      yesNo(record.oneOff),
      record.note,
      yesNo(record.seed),
    ]
    lines.push(cells.map((cell) => csvEscape(cell)).join(','))
  }
  return `\uFEFF${lines.join('\n')}\n`
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    if (row.some((value) => value.trim() !== '')) rows.push(row)
  }
  return rows
}

export interface CsvImport {
  records: LedgerRecord[]
  errors: string[]
}

function flag(value: string): boolean | null {
  if (value === '是' || value === 'Y' || value === 'true') return true
  if (value === '否' || value === '' || value === 'N' || value === 'false') return false
  return null
}

export function importCsv(text: string, snapshot: LedgerSnapshot, now = new Date().toISOString()): CsvImport {
  const table = parseCsv(text)
  if (table.length === 0) return { records: [], errors: ['檔案是空的'] }
  const header = table[0].map((cell) => cell.trim())
  const missing = CSV_HEADERS.filter((name) => !header.includes(name))
  if (missing.length > 0) return { records: [], errors: [`缺少欄位：${missing.join('、')}`] }
  const indexOf = (name: string) => header.indexOf(name)
  const records: LedgerRecord[] = []
  const errors: string[] = []
  table.slice(1).forEach((row, rowIndex) => {
    const line = rowIndex + 2
    const cell = (name: string) => (row[indexOf(name)] ?? '').trim()
    const business = snapshot.businesses.find((item) => item.name === cell('店別'))
    if (!business) {
      errors.push(`第 ${line} 行：找不到店別「${cell('店別')}」`)
      return
    }
    const type = LABEL_TO_TYPE[cell('類型')]
    if (!type) {
      errors.push(`第 ${line} 行：類型要填收入、支出或撥款`)
      return
    }
    const category = business.categories.find((item) => item.name === cell('分類'))
    if (!category) {
      errors.push(`第 ${line} 行：${business.name}沒有分類「${cell('分類')}」`)
      return
    }
    const amount = Number(cell('金額').replace(/,/g, ''))
    if (!Number.isSafeInteger(amount) || amount < 0) {
      errors.push(`第 ${line} 行：金額要是 0 以上的整數`)
      return
    }
    const date = cell('付款日期')
    if (!parseISODate(date)) {
      errors.push(`第 ${line} 行：付款日期格式要像 2026-10-03`)
      return
    }
    const accountingMonth = cell('帳務月份')
    if (!isMonthKey(accountingMonth)) {
      errors.push(`第 ${line} 行：帳務月份格式要像 2026-10`)
      return
    }
    const splits = parseSplits(cell('收款拆分'))
    if (!splits) {
      errors.push(`第 ${line} 行：收款拆分格式要像 現金=100;Line Pay=200`)
      return
    }
    if (splits.length > 0 && splits.reduce((sum, split) => sum + split.amount, 0) !== amount) {
      errors.push(`第 ${line} 行：收款拆分合計要等於金額`)
      return
    }
    const status = LABEL_TO_STATUS[cell('狀態')]
    if (!status) {
      errors.push(`第 ${line} 行：狀態要填已付款或計畫中`)
      return
    }
    const refundable = flag(cell('可退押金'))
    const closed = flag(cell('公休'))
    const gap = flag(cell('缺漏'))
    const oneOff = flag(cell('一次性'))
    const seeded = flag(cell('起始資料'))
    if (refundable === null || closed === null || gap === null || oneOff === null || seeded === null) {
      errors.push(`第 ${line} 行：是／否欄位看不懂`)
      return
    }
    const periodStart = cell('期間起')
    const periodEnd = cell('期間迄')
    if ((periodStart && !parseISODate(periodStart)) || (periodEnd && !parseISODate(periodEnd))) {
      errors.push(`第 ${line} 行：期間日期格式不對`)
      return
    }
    if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
      errors.push(`第 ${line} 行：期間要起迄都填，或都留空`)
      return
    }
    const preTaxText = cell('未稅金額').replace(/,/g, '')
    const taxText = cell('稅額').replace(/,/g, '')
    const preTax = preTaxText === '' ? null : Number(preTaxText)
    const tax = taxText === '' ? null : Number(taxText)
    if ((preTax === null) !== (tax === null)) {
      errors.push(`第 ${line} 行：未稅金額和稅額要一起填，或都留空`)
      return
    }
    if (
      (preTax !== null && (!Number.isSafeInteger(preTax) || preTax < 0)) ||
      (tax !== null && (!Number.isSafeInteger(tax) || tax < 0))
    ) {
      errors.push(`第 ${line} 行：未稅金額和稅額要是 0 以上的整數`)
      return
    }
    if (preTax !== null && tax !== null && preTax + tax !== amount) {
      errors.push(`第 ${line} 行：未稅金額加稅額要等於含稅金額`)
      return
    }
    const id = cell('編號') || newId('rec')
    const existing = snapshot.records.find((item) => item.id === id)
    records.push({
      id,
      businessId: business.id,
      date,
      accountingMonth,
      type,
      categoryId: category.id,
      amount,
      preTax,
      tax,
      note: cell('備註'),
      paymentMethod: cell('付款方式'),
      splits,
      vendor: cell('廠商'),
      productLine: cell('產品線'),
      refundable,
      status,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      closed,
      gap,
      oneOff,
      seed: seeded,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  })
  return { records, errors }
}
