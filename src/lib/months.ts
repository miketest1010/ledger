import { isMonthKey } from './dates.ts'
import type { LedgerRecord, Scope } from './types.ts'

/** Accounting months that actually have records, newest first. */
export function accountingMonths(records: LedgerRecord[], scope: Scope): string[] {
  const keys = new Set<string>()
  for (const record of records) {
    if (scope !== 'all' && record.businessId !== scope) continue
    if (!isMonthKey(record.accountingMonth)) continue
    keys.add(record.accountingMonth)
  }
  return [...keys].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
}

/** `months` is newest first. A value outside the list steps into the newest month when moving older. */
export function adjacentMonth(months: string[], current: string, direction: 'older' | 'newer'): string | null {
  const index = months.indexOf(current)
  if (index < 0) return direction === 'older' ? (months[0] ?? null) : null
  const next = direction === 'older' ? index + 1 : index - 1
  if (next < 0 || next >= months.length) return null
  return months[next] ?? null
}
