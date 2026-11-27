export interface TaipeiDate {
  year: number
  month: number
  day: number
  iso: string
  monthKey: string
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function monthKeyOf(year: number, month: number): string {
  return `${year}-${pad2(month)}`
}

export function taipeiToday(now = new Date()): TaipeiDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  const iso = `${year}-${pad2(month)}-${pad2(day)}`
  return { year, month, day, iso, monthKey: iso.slice(0, 7) }
}

export function formatTaipeiLong(today: TaipeiDate): string {
  return `${today.year}年${today.month}月${today.day}日`
}

export function parseISODate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

export function isMonthKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthLabel(month: string): string {
  const [, m] = month.split('-')
  return `${Number(m)}月`
}

export function monthLabelLong(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

export function addMonths(month: string, count: number): string {
  const [yearText, monthText] = month.split('-')
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + count, 1))
  return monthKeyOf(date.getUTCFullYear(), date.getUTCMonth() + 1)
}

export function monthSequence(from: string, to: string): string[] {
  if (from > to) return []
  const months: string[] = []
  let cursor = from
  while (cursor <= to) {
    months.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return months
}

export function formatShortDate(iso: string): string {
  const parsed = parseISODate(iso)
  if (!parsed) return iso
  return `${parsed.m}/${parsed.d}`
}

export function toRoc(iso: string): string {
  const parsed = parseISODate(iso)
  if (!parsed) return iso
  return `${parsed.y - 1911}/${parsed.m}/${parsed.d}`
}

/** 整月期間顯示成年月，特定日期則顯示完整日期。 */
export function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const a = parseISODate(start)
  const b = parseISODate(end)
  if (!a || !b) return `${start}–${end}`
  const startFull = a.d === 1
  const endFull = b.d === daysInMonth(b.y, b.m)
  if (startFull && endFull) return `${a.y}/${pad2(a.m)}–${b.y}/${pad2(b.m)}`
  return `${a.y}/${pad2(a.m)}/${pad2(a.d)}–${b.y}/${pad2(b.m)}/${pad2(b.d)}`
}

export function formatDayList(dates: string[]): string {
  return dates
    .map((iso) => {
      const parsed = parseISODate(iso)
      return parsed ? `${parsed.m}/${parsed.d}` : iso
    })
    .join('、')
}
