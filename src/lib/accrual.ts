import { daysInMonth, pad2, parseISODate } from './dates.ts'

export interface MonthSpan {
  month: string
  days: number
}

function utcTime(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day)
}

/** 起迄日都算在內。用 UTC 逐日走，避免時區把月底算錯。 */
export function periodMonths(startIso: string, endIso: string): MonthSpan[] {
  const start = parseISODate(startIso)
  const end = parseISODate(endIso)
  if (!start || !end) return []
  const startTime = utcTime(start.y, start.m, start.d)
  const endTime = utcTime(end.y, end.m, end.d)
  if (endTime < startTime) return []
  const counts = new Map<string, number>()
  for (let time = startTime; time <= endTime; time += 86_400_000) {
    const date = new Date(time)
    const key = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([month, days]) => ({ month, days }))
}

function monthFullyCovered(month: string, startIso: string, endIso: string): boolean {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  const last = daysInMonth(year, monthNumber)
  const firstIso = `${month}-01`
  const lastIso = `${month}-${pad2(last)}`
  return startIso <= firstIso && endIso >= lastIso
}

/** 把整數金額依權重分完，餘數給餘數最大的那幾個月。 */
export function allocateIntegers(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (amount === 0 || weights.length === 0 || total <= 0) return weights.map(() => 0)
  const floors = weights.map((weight) => Math.floor((amount * weight) / total))
  let left = amount - floors.reduce((sum, value) => sum + value, 0)
  const order = weights
    .map((weight, index) => ({ index, remainder: (amount * weight) % total }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  const out = floors.slice()
  for (let index = 0; index < left; index += 1) out[order[index].index] += 1
  return out
}

/**
 * 跨月的服務期間才需要分攤。
 * 每個被碰到的月份都是完整的一個月（例如 8/1–9/30）時，按月平分。
 * 否則按日數分攤，起迄日都算。合計一定等於原金額。
 */
export function spreadAmount(
  amount: number,
  startIso: string,
  endIso: string,
): { month: string; amount: number }[] {
  const spans = periodMonths(startIso, endIso)
  if (spans.length === 0) return []
  if (spans.length === 1) return [{ month: spans[0].month, amount }]
  const fullMonths = spans.every((span) => monthFullyCovered(span.month, startIso, endIso))
  const weights = fullMonths ? spans.map(() => 1) : spans.map((span) => span.days)
  const amounts = allocateIntegers(amount, weights)
  return spans.map((span, index) => ({ month: span.month, amount: amounts[index] ?? 0 }))
}
