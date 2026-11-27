import { useMemo, useState } from 'react'
import { amountOf, compareMonths, monthDelta, type CompareBasis, type MonthAmount } from '@/lib/compare.ts'
import { monthLabelLong } from '@/lib/dates.ts'
import { formatTwd } from '@/lib/money.ts'
import { accountingMonths } from '@/lib/months.ts'
import type { LedgerSnapshot, Scope } from '@/lib/types.ts'
import { cn } from '@/lib/utils.ts'

interface CompareViewProps {
  snapshot: LedgerSnapshot
  scope: Scope
  preferredMonth: string | null
}

const BASES: { id: CompareBasis; label: string }[] = [
  { id: 'paid', label: '已付款' },
  { id: 'planned', label: '計畫中' },
  { id: 'both', label: '兩者' },
]

export function CompareView({ snapshot, scope, preferredMonth }: CompareViewProps) {
  const available = useMemo(
    () => accountingMonths(snapshot.records, scope),
    [snapshot.records, scope],
  )
  const [picked, setPicked] = useState<string[]>(() => initialPick(available, preferredMonth))
  const [basis, setBasis] = useState<CompareBasis>('paid')
  const selected = picked.filter((month) => available.includes(month)).sort()
  const model = compareMonths({
    records: snapshot.records,
    businesses: snapshot.businesses,
    scope,
    months: selected,
  })
  const scopeLabel = scope === 'cafe' ? '諾奇意咖啡' : scope === 'laya' ? '拉亞漢堡' : '全部'

  function toggle(month: string) {
    setPicked((current) => (current.includes(month) ? current.filter((item) => item !== month) : [...current, month]))
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">月對月比較</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {scopeLabel}。勾兩個以上的帳務月份，並排看收入、支出、淨額和分類。差額是跟左邊那個月比。
        </p>
      </div>

      <div className="flex rounded-xl border border-line bg-card p-1" role="group" aria-label="金額範圍">
        {BASES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={basis === item.id}
            className={cn('h-10 flex-1 rounded-lg text-sm', basis === item.id ? 'bg-ink text-paper' : 'text-muted')}
            onClick={() => setBasis(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {basis === 'both' && (
        <p className="text-sm text-muted">上排是已付款，下排是計畫中。差額用兩者合計。</p>
      )}

      {available.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          這個範圍還沒有紀錄。
        </p>
      ) : (
        <fieldset>
          <legend className="text-xs text-muted">選擇月份</legend>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {available.map((month) => {
              const on = picked.includes(month)
              return (
                <label
                  key={month}
                  className={cn(
                    'inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm',
                    on ? 'border-ink bg-ink text-paper' : 'border-line bg-card',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => toggle(month)}
                  />
                  {monthLabelLong(month)}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {available.length > 0 && selected.length < 2 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          再選一個月就能並排比較。
        </p>
      ) : null}

      {selected.length >= 2 && (
        <section className="rounded-2xl border border-line bg-card p-3 md:p-5">
          <p className="mb-3 text-xs text-muted md:hidden">表格可以左右滑。</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="sticky left-0 z-10 bg-card py-2 pr-3 font-medium">項目</th>
                  {model.months.map((month, index) => (
                    <HeaderCells key={month} month={month} showDelta={index > 0} />
                  ))}
                </tr>
              </thead>
              <tbody>
                <SummaryRow label="收入" kind="income" cells={model.income} basis={basis} />
                <SummaryRow label="支出" kind="expense" cells={model.expense} basis={basis} />
                <SummaryRow label="淨額" kind="net" cells={model.net} basis={basis} />
                <tr>
                  <th
                    colSpan={model.months.length * 2}
                    className="sticky left-0 bg-paper py-2 pr-3 text-left text-xs font-medium text-muted"
                  >
                    分類
                  </th>
                </tr>
                {visibleCategories(model.categories, basis).map((row) => (
                  <SummaryRow key={row.key} label={row.name} kind={row.kind} cells={row.amounts} basis={basis} />
                ))}
              </tbody>
            </table>
          </div>
          {visibleCategories(model.categories, basis).length === 0 && (
            <p className="mt-3 text-sm text-muted">這幾個月沒有這個範圍的分類金額。</p>
          )}
          <p className="mt-3 text-xs leading-5 text-muted">
            撥款、公休、待補，以及可退押金，沒有算進收入、支出和淨額。支出變多標紅，收入或淨額變多標綠。
          </p>
        </section>
      )}
    </div>
  )
}

function initialPick(months: string[], preferred: string | null): string[] {
  if (months.length === 0) return []
  if (months.length === 1) return [months[0] ?? '']
  if (preferred && months.includes(preferred)) {
    const index = months.indexOf(preferred)
    const other = months[index + 1] ?? months[index - 1]
    return other ? [preferred, other] : [preferred]
  }
  return months.slice(0, 2)
}

function visibleCategories(
  rows: { key: string; name: string; kind: 'income' | 'expense'; amounts: MonthAmount[] }[],
  basis: CompareBasis,
) {
  return rows.filter((row) => row.amounts.some((cell) => amountOf(cell, basis) !== 0))
}

function HeaderCells({ month, showDelta }: { month: string; showDelta: boolean }) {
  return (
    <>
      {showDelta && <th className="px-2 py-2 text-right font-medium">較上月</th>}
      <th className="px-2 py-2 text-right font-medium">{monthLabelLong(month)}</th>
    </>
  )
}

function SummaryRow({
  label,
  kind,
  cells,
  basis,
}: {
  label: string
  kind: 'income' | 'expense' | 'net'
  cells: MonthAmount[]
  basis: CompareBasis
}) {
  return (
    <tr className="border-t border-line">
      <th className="sticky left-0 z-10 bg-card py-2.5 pr-3 text-left font-medium">{label}</th>
      {cells.map((cell, index) => {
        const value = amountOf(cell, basis)
        const previous = index > 0 ? amountOf(cells[index - 1] ?? cell, basis) : null
        return (
          <ValueCells
            key={`${label}-${index}`}
            value={value}
            cell={cell}
            basis={basis}
            previous={previous}
            kind={kind}
          />
        )
      })}
    </tr>
  )
}

function ValueCells({
  value,
  cell,
  basis,
  previous,
  kind,
}: {
  value: number
  cell: MonthAmount
  basis: CompareBasis
  previous: number | null
  kind: 'income' | 'expense' | 'net'
}) {
  const delta = previous === null ? null : monthDelta(value, previous)
  return (
    <>
      {delta && (
        <td className={cn('px-2 py-2.5 text-right align-top', deltaClass(kind, delta.difference))}>
          <DeltaText difference={delta.difference} percent={delta.percent} />
        </td>
      )}
      <td className="num px-2 py-2.5 text-right align-top">
        {basis === 'both' ? (
          <span className="block">
            <span className="block">{formatTwd(cell.paid)}</span>
            <span className="block text-xs text-planned">計畫 {formatTwd(cell.planned)}</span>
          </span>
        ) : (
          formatTwd(value)
        )}
      </td>
    </>
  )
}

function DeltaText({ difference, percent }: { difference: number; percent: number | null }) {
  if (difference === 0) return <span className="text-muted">—</span>
  const up = difference > 0
  return (
    <span className="num block whitespace-nowrap">
      {up ? '▲' : '▼'} {formatTwd(Math.abs(difference))}
      {percent !== null && <span className="mt-0.5 block text-xs">{formatPercentChange(percent)}</span>}
    </span>
  )
}

function deltaClass(kind: 'income' | 'expense' | 'net', difference: number): string {
  if (difference === 0) return ''
  const favorable = kind === 'expense' ? difference < 0 : difference > 0
  return favorable ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
}

function formatPercentChange(percent: number): string {
  const rounded = Math.round(percent * 10) / 10
  const abs = Math.abs(rounded)
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1)
  if (rounded > 0) return `+${body}%`
  if (rounded < 0) return `−${body}%`
  return '0%'
}
