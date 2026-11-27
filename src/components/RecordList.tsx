import { useMemo, useState } from 'react'
import { MonthMenu } from '@/components/MonthMenu.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { findBusiness, findCategory } from '@/lib/defaults.ts'
import { formatPeriod, formatShortDate } from '@/lib/dates.ts'
import { formatTwd } from '@/lib/money.ts'
import { accountingMonths } from '@/lib/months.ts'
import type { EntryType, LedgerRecord, LedgerSnapshot, Scope } from '@/lib/types.ts'
import { TYPE_LABEL } from '@/lib/types.ts'
import { cn, fieldClass } from '@/lib/utils.ts'

interface RecordListProps {
  snapshot: LedgerSnapshot
  scope: Scope
  month: string
  onMonth: (month: string) => void
  onEdit: (id: string) => void
  onCreate: () => void
}

export function RecordList({ snapshot, scope, month, onMonth, onEdit, onCreate }: RecordListProps) {
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')
  const [query, setQuery] = useState('')
  const months = useMemo(() => accountingMonths(snapshot.records, scope), [scope, snapshot.records])

  const rows = snapshot.records
    .filter((record) => scope === 'all' || record.businessId === scope)
    .filter((record) => month === 'all' || record.accountingMonth === month)
    .filter((record) => typeFilter === 'all' || record.type === typeFilter)
    .filter((record) => matches(record, snapshot, query))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">紀錄</h2>
          <p className="mt-1 text-sm text-muted">{rows.length} 筆</p>
        </div>
        <Button onClick={onCreate}>記一筆</Button>
      </div>
      <MonthMenu
        months={months}
        value={month}
        onChange={onMonth}
        extra={{ value: 'all', label: '全部月份' }}
      />
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <Input value={query} placeholder="搜尋備註、廠商、分類" onChange={(event) => setQuery(event.target.value)} />
        <select
          className={fieldClass}
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as EntryType | 'all')}
        >
          <option value="all">全部類型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
          <option value="settlement">撥款</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          沒有符合的紀錄。
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {rows.map((record) => (
            <li key={record.id}>
              <RecordButton record={record} snapshot={snapshot} scope={scope} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function matches(record: LedgerRecord, snapshot: LedgerSnapshot, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const category = findCategory(snapshot.businesses, record.categoryId)
  const haystack = [record.note, record.vendor, record.paymentMethod, category?.name, String(record.amount)]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function RecordButton({
  record,
  snapshot,
  scope,
  onEdit,
}: {
  record: LedgerRecord
  snapshot: LedgerSnapshot
  scope: Scope
  onEdit: (id: string) => void
}) {
  const category = findCategory(snapshot.businesses, record.categoryId)
  const business = findBusiness(snapshot.businesses, record.businessId)
  const shifted = record.date.slice(0, 7) !== record.accountingMonth
  const title = record.closed ? '公休' : record.vendor || record.note || category?.name || TYPE_LABEL[record.type]
  const period = formatPeriod(record.periodStart, record.periodEnd)
  return (
    <button type="button" className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left" onClick={() => onEdit(record.id)}>
      <span className="min-w-0">
        <span className="text-xs text-muted">
          {formatShortDate(record.date)}
          {shifted ? ` · 帳 ${record.accountingMonth.slice(5)}月` : ''}
          {scope === 'all' ? ` · ${business?.name ?? ''}` : ''}
        </span>
        <span className="mt-0.5 block truncate">{title}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          <Badge>{category?.name ?? '未分類'}</Badge>
          {record.type === 'settlement' && <Badge>撥款</Badge>}
          {record.status === 'planned' && <Badge>計畫</Badge>}
          {record.refundable && <Badge>可退</Badge>}
          {record.oneOff && <Badge>一次性</Badge>}
          {record.productLine && <Badge>{record.productLine}</Badge>}
          {record.closed && <Badge>公休</Badge>}
          {record.gap && <Badge>待補</Badge>}
          {record.tax !== null && (
            <Badge>{`${record.type === 'income' ? '銷項' : '進項'} ${formatTwd(record.tax)}`}</Badge>
          )}
        </span>
        {record.splits.length > 0 && (
          <span className="mt-1 block text-xs text-muted">
            {record.splits.map((split) => `${split.method} ${formatTwd(split.amount)}`).join(' · ')}
          </span>
        )}
        {period && <span className="mt-1 block text-xs text-muted">期間 {period}</span>}
        {record.note && record.note !== title && <span className="mt-1 block text-xs text-muted">{record.note}</span>}
      </span>
      <span className={cn('num shrink-0 text-lg', record.type === 'income' ? 'text-income' : record.type === 'settlement' ? 'text-linepay' : 'text-expense')}>
        {formatTwd(record.amount)}
      </span>
    </button>
  )
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs text-muted">{children}</span>
}
