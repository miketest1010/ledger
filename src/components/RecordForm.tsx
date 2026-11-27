import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { ConfirmDialog } from '@/components/ui/dialog.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { applyDraftPatch, validateDraft, type Draft } from '@/lib/draft.ts'
import { findBusiness } from '@/lib/defaults.ts'
import { toRoc } from '@/lib/dates.ts'
import { parseTwdInput } from '@/lib/money.ts'
import type { Business, EntryStatus, EntryType, LedgerRecord } from '@/lib/types.ts'
import { PAYMENT_METHODS, STATUS_LABEL, TYPE_LABEL } from '@/lib/types.ts'
import { fieldClass } from '@/lib/utils.ts'
import { splitInclusiveVat } from '@/lib/vat.ts'

interface RecordFormProps {
  draft: Draft
  businesses: Business[]
  onChange: (draft: Draft) => void
  onSave: (record: LedgerRecord) => void
  onDelete: (id: string) => void
  onCancel: () => void
}

const TYPES: EntryType[] = ['income', 'expense', 'settlement']
const STATUSES: EntryStatus[] = ['paid', 'planned']

export function RecordForm({ draft, businesses, onChange, onSave, onDelete, onCancel }: RecordFormProps) {
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const business = findBusiness(businesses, draft.businessId)
  const categories = business?.categories.filter((category) => category.kind === draft.type) ?? []

  function update(patch: Partial<Draft>) {
    onChange(applyDraftPatch(draft, patch, businesses))
  }

  function fillVat() {
    const total = draft.useSplits
      ? draft.splits.reduce((sum, row) => sum + (parseTwdInput(row.amount) ?? 0), 0)
      : parseTwdInput(draft.amount)
    if (total === null) {
      setErrors(['先填好含稅金額，才能拆 5% 稅額。'])
      return
    }
    const split = splitInclusiveVat(total)
    update({ useTax: true, preTax: String(split.preTax), tax: String(split.tax) })
    setErrors([])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = validateDraft(draft, businesses)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    onSave(result.record)
  }

  return (
    <form className="mx-auto max-w-xl space-y-5" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{draft.id ? '編輯紀錄' : '記一筆'}</h2>
        <Button variant="ghost" onClick={onCancel}>
          返回
        </Button>
      </div>

      {errors.length > 0 && (
        <ul className="rounded-xl border border-expense/30 bg-white px-3 py-2 text-sm text-expense" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <Field label="店別" htmlFor="business">
        <select
          id="business"
          className={fieldClass}
          value={draft.businessId}
          onChange={(event) => update({ businessId: event.target.value as Draft['businessId'] })}
        >
          {businesses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="text-sm font-medium">類型</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {TYPES.map((type) => (
            <Button key={type} variant={draft.type === type ? 'default' : 'outline'} onClick={() => update({ type })}>
              {TYPE_LABEL[type]}
            </Button>
          ))}
        </div>
        {draft.type === 'settlement' && (
          <p className="mt-2 text-sm text-muted">撥款是 Line Pay 匯入的錢，不算營收。</p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">狀態</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {STATUSES.map((status) => (
            <Button
              key={status}
              variant={draft.status === status ? 'default' : 'outline'}
              onClick={() => update({ status })}
            >
              {STATUS_LABEL[status]}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={draft.status === 'planned' ? '預計日期' : '付款／營業日期'} htmlFor="date">
          <Input id="date" type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} required />
        </Field>
        <Field label="帳務月份" htmlFor="month">
          <Input
            id="month"
            type="month"
            value={draft.accountingMonth}
            onChange={(event) => update({ accountingMonth: event.target.value })}
            required
          />
        </Field>
      </div>
      <p className="text-sm leading-6 text-muted">儀表板依帳務月份統計，可以和付款日不同。例如 11/10 轉帳、帳務月份選 10 月。</p>

      <Field label="分類" htmlFor="category">
        <select
          id="category"
          className={fieldClass}
          value={draft.categoryId}
          onChange={(event) => update({ categoryId: event.target.value })}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>

      {draft.type === 'income' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.closed} onChange={(event) => update({ closed: event.target.checked })} />
          這天公休，不計入營收
        </label>
      )}

      {!draft.closed && draft.type === 'income' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.useSplits}
            onChange={(event) => update({ useSplits: event.target.checked })}
          />
          拆開收款方式（現金、Line Pay）
        </label>
      )}

      {!draft.closed && draft.useSplits && draft.type === 'income' ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">收款拆分</legend>
          {draft.splits.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_8rem_auto] gap-2">
              <Input
                aria-label={`收款方式 ${index + 1}`}
                list="payment-methods"
                value={row.method}
                onChange={(event) => {
                  const splits = draft.splits.slice()
                  splits[index] = { ...row, method: event.target.value }
                  update({ splits })
                }}
              />
              <AmountInput
                ariaLabel={`金額 ${index + 1}`}
                value={row.amount}
                onChange={(amount) => {
                  const splits = draft.splits.slice()
                  splits[index] = { ...row, amount }
                  update({ splits })
                }}
              />
              <Button
                variant="ghost"
                onClick={() => update({ splits: draft.splits.filter((_, item) => item !== index) })}
              >
                移除
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => update({ splits: [...draft.splits, { method: '', amount: '' }] })}
            >
              加一個方式
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                update({
                  splits: [
                    { method: '現金', amount: '' },
                    { method: 'Line Pay', amount: '' },
                  ],
                })
              }
            >
              現金／Line Pay
            </Button>
          </div>
        </fieldset>
      ) : (
        !draft.closed && (
          <Field label="金額（含稅，整數元）" htmlFor="amount">
            <AmountInput id="amount" value={draft.amount} onChange={(amount) => update({ amount })} />
          </Field>
        )
      )}

      {!draft.closed && draft.type !== 'settlement' && (
        <fieldset className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <legend className="px-1 text-sm font-medium">稅額（選填）</legend>
          <p className="text-sm leading-6 text-muted">
            收入填銷項稅額，支出填進項稅額。2026 年 11 月起諾奇意開統一發票，稅率 5%。未稅加稅額要等於上面的含稅金額。
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.useTax} onChange={(event) => update({ useTax: event.target.checked })} />
            這筆要登錄未稅與稅額
          </label>
          {draft.useTax && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="未稅金額" htmlFor="pre-tax">
                <AmountInput id="pre-tax" value={draft.preTax} onChange={(preTax) => update({ preTax })} />
              </Field>
              <Field label={draft.type === 'income' ? '銷項稅額' : '進項稅額'} htmlFor="tax">
                <AmountInput id="tax" value={draft.tax} onChange={(tax) => update({ tax })} />
              </Field>
            </div>
          )}
          <Button variant="outline" onClick={fillVat}>
            依含稅金額拆 5%
          </Button>
        </fieldset>
      )}

      {draft.type === 'income' && (
        <Field label="產品線（選填）" htmlFor="product-line">
          <Input
            id="product-line"
            value={draft.productLine}
            placeholder="例如寵物蛋糕"
            list="product-lines"
            onChange={(event) => update({ productLine: event.target.value })}
          />
          <datalist id="product-lines">
            <option value="寵物蛋糕" />
          </datalist>
        </Field>
      )}

      <Field label="廠商（選填）" htmlFor="vendor">
        <Input
          id="vendor"
          value={draft.vendor}
          placeholder="選填"
          onChange={(event) => update({ vendor: event.target.value })}
        />
      </Field>

      {!draft.useSplits && (
        <Field label="付款方式（選填）" htmlFor="method">
          <Input
            id="method"
            list="payment-methods"
            value={draft.paymentMethod}
            onChange={(event) => update({ paymentMethod: event.target.value })}
          />
          <datalist id="payment-methods">
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method} />
            ))}
          </datalist>
        </Field>
      )}

      {draft.type === 'expense' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.refundable}
              onChange={(event) => update({ refundable: event.target.checked })}
            />
            這是可退押金或保證金，不計入已花掉的成本
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.oneOff}
              onChange={(event) => update({ oneOff: event.target.checked })}
            />
            以前年度或一次性，可從營業觀點排除
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="保障／服務期間起" htmlFor="period-start">
          <Input
            id="period-start"
            type="date"
            value={draft.periodStart}
            onChange={(event) => update({ periodStart: event.target.value })}
          />
        </Field>
        <Field label="保障／服務期間迄" htmlFor="period-end">
          <Input
            id="period-end"
            type="date"
            value={draft.periodEnd}
            onChange={(event) => update({ periodEnd: event.target.value })}
          />
        </Field>
      </div>
      {draft.periodStart && draft.periodEnd && (
        <p className="text-sm text-muted">
          民國 {toRoc(draft.periodStart)}–{toRoc(draft.periodEnd)}
        </p>
      )}

      {draft.type === 'income' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.gap} onChange={(event) => update({ gap: event.target.checked })} />
          來源沒有這一天，先不計入營收
        </label>
      )}

      <Field label="備註" htmlFor="note">
        <Textarea id="note" value={draft.note} onChange={(event) => update({ note: event.target.value })} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg">
          儲存
        </Button>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        {draft.id && (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            刪除
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="刪除這筆紀錄？"
        description="刪掉就不能復原。若這是起始資料，清除起始資料時本來也會把它刪掉。"
        confirmLabel="刪除"
        destructive
        onOpenChange={setConfirmDelete}
        onConfirm={() => {
          if (draft.id) onDelete(draft.id)
        }}
      />
    </form>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function AmountInput({
  id,
  value,
  onChange,
  ariaLabel,
}: {
  id?: string
  value: string
  onChange: (digits: string) => void
  ariaLabel?: string
}) {
  const digits = value.replace(/\D/g, '')
  const shown = digits === '' ? '' : Number(digits).toLocaleString('zh-Hant-TW')
  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      inputMode="numeric"
      value={shown}
      placeholder="0"
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
    />
  )
}
