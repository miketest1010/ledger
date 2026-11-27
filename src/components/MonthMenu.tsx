import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabelLong } from '@/lib/dates.ts'
import { adjacentMonth } from '@/lib/months.ts'
import { fieldClass } from '@/lib/utils.ts'

interface MonthMenuProps {
  /** Newest first. */
  months: string[]
  value: string
  onChange: (value: string) => void
  extra?: { value: string; label: string }
  label?: string
}

export function MonthMenu({ months, value, onChange, extra, label = '帳務月份' }: MonthMenuProps) {
  const listed = months.includes(value) || value === extra?.value ? months : [value, ...months]
  const older = adjacentMonth(months, value, 'older')
  const newer = adjacentMonth(months, value, 'newer')
  const selectId = 'accounting-month'

  return (
    <div>
      <label htmlFor={selectId} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-card disabled:opacity-40"
          aria-label={months.includes(value) ? '上個月' : '最近一個月'}
          disabled={older === null}
          onClick={() => {
            if (older) onChange(older)
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <select id={selectId} className={fieldClass} value={listed.includes(value) || value === extra?.value ? value : ''} onChange={(event) => onChange(event.target.value)}>
          {extra && <option value={extra.value}>{extra.label}</option>}
          {listed.length === 0 && !extra && <option value="">尚無月份</option>}
          {listed.map((month) => (
            <option key={month} value={month}>
              {monthLabelLong(month)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-card disabled:opacity-40"
          aria-label="下個月"
          disabled={newer === null}
          onClick={() => {
            if (newer) onChange(newer)
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
