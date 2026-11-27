import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildDashboard, type DetailRange, type MonthFacts, type StartupSummary, type Totals } from '@/lib/aggregate.ts'
import { findCategory } from '@/lib/defaults.ts'
import { formatDayList, formatShortDate, monthLabel, monthLabelLong, type TaipeiDate } from '@/lib/dates.ts'
import { compactTwd, formatTwd } from '@/lib/money.ts'
import type { LedgerMode, LedgerRecord, LedgerSnapshot, Scope } from '@/lib/types.ts'
import { cafeExpenseIncomplete, estimateCafeVat, INCOMPLETE_EXPENSE_NOTE } from '@/lib/vat.ts'
import { cn } from '@/lib/utils.ts'

interface DashboardProps {
  snapshot: LedgerSnapshot
  scope: Scope
  mode: LedgerMode
  onMode: (mode: LedgerMode) => void
  detail: DetailRange
  onDetail: (detail: DetailRange) => void
  includePlanned: boolean
  onIncludePlanned: (value: boolean) => void
  excludeOneOff: boolean
  onExcludeOneOff: (value: boolean) => void
  onEdit: (id: string) => void
  onCreate: () => void
  onOpenSettings: () => void
  today: TaipeiDate
}

export function Dashboard(props: DashboardProps) {
  const { snapshot, scope, mode, detail, includePlanned, excludeOneOff, today } = props
  const model = buildDashboard({
    records: snapshot.records,
    businesses: snapshot.businesses,
    scope,
    mode,
    today,
    detail,
    includePlanned,
    excludeOneOff,
  })
  const business = scope === 'all' ? null : snapshot.businesses.find((item) => item.id === scope)
  const detailLabel = detail.kind === 'ytd' ? '今年至今' : monthLabelLong(detail.month)
  const showTender = scope !== 'laya'
  const ytdIncomplete = scope !== 'laya' && model.months.some((row) => cafeExpenseIncomplete(row.month, scope))
  const vatPeriods = scope === 'laya' ? [] : estimateCafeVat(snapshot.records, today.monthKey)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{business ? business.name : '兩店合計'}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {business
            ? `${business.englishName} · ${business.place} · ${business.phase === 'operating' ? '營業中' : '籌備中'}。${business.description}`
            : '諾奇意咖啡的營收，加上拉亞漢堡新莊店已入帳的開辦支出。'}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Kpi label={`本月 · ${monthLabelLong(today.monthKey)}`} totals={model.thisMonth} showTender={showTender} />
        <Kpi
          label={`${today.year} 年至今`}
          totals={model.ytd}
          showTender={showTender}
          note={ytdIncomplete ? `11 月以前的支出還沒記齊，今年至今的支出和淨額${INCOMPLETE_EXPENSE_NOTE}。` : undefined}
        />
      </div>
      {model.productLines.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h3 className="font-semibold">產品線 · {detailLabel}</h3>
          <ul className="mt-3 space-y-2">
            {model.productLines.map((line) => (
              <li key={line.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{line.name}</span>
                <span className="num">{formatTwd(line.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FactsNote facts={model.thisFacts} />
      {(model.thisMonth.oneOff > 0 || model.ytd.oneOff > 0) && (
        <label className="flex items-start gap-2 rounded-xl border border-line bg-card px-3 py-3 text-sm leading-6">
          <input
            className="mt-1"
            type="checkbox"
            checked={excludeOneOff}
            onChange={(event) => props.onExcludeOneOff(event.target.checked)}
          />
          <span>
            營業觀點：排除一次性／以前年度。
            {excludeOneOff
              ? `已排除 ${formatTwd(model.ytd.oneOff)} 元，支出與淨額不含這部分。`
              : `目前含在支出裡。本月 ${formatTwd(model.thisMonth.oneOff)} 元，今年 ${formatTwd(model.ytd.oneOff)} 元。`}
          </span>
        </label>
      )}

      {scope === 'laya' && model.startup && (
        <StartupCard summary={model.startup} onEdit={props.onEdit} onOpenSettings={props.onOpenSettings} />
      )}

      <section className="rounded-2xl border border-line bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">各月收支</h3>
            <p className="mt-1 text-sm text-muted">淨額＝收入－支出。不含可退押金，也不含 Line Pay 撥款。</p>
          </div>
          <div className="flex rounded-xl border border-line p-1" role="group" aria-label="統計方式">
            <ModeButton active={mode === 'accounting'} onClick={() => props.onMode('accounting')}>
              帳務月份
            </ModeButton>
            <ModeButton active={mode === 'accrual'} onClick={() => props.onMode('accrual')}>
              權責發生
            </ModeButton>
          </div>
        </div>
        {scope !== 'laya' && (
          <p className="mt-3 rounded-xl bg-laya-soft px-3 py-2 text-sm leading-6 text-ink">
            諾奇意咖啡在 2026 年 11 月以前的支出還沒記齊。那些月份會標「{INCOMPLETE_EXPENSE_NOTE}」。
          </p>
        )}
        <p className="mt-3 text-sm leading-6 text-muted">
          {mode === 'accounting'
            ? '每筆算在它的帳務月份。例如 11/10 轉帳、帳務月份 10 月，就算在 10 月。'
            : '跨月的服務期間會攤開：電費這種整月帳單按月平分，保險按保障日數分攤。營收和撥款不攤。'}
        </p>
        {mode === 'accrual' && model.futureAccrual > 0 && (
          <p className="mt-1 text-sm text-muted">今年之後還有攤提 {formatTwd(model.futureAccrual)} 元，沒有算進今年至今。</p>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">月份</th>
                <th className="py-2 text-right font-medium">收入</th>
                {showTender && <th className="py-2 text-right font-medium">現金</th>}
                {showTender && <th className="py-2 text-right font-medium">Line Pay</th>}
                <th className="py-2 text-right font-medium">支出</th>
                <th className="py-2 text-right font-medium">淨額</th>
                {showTender && <th className="py-2 text-right font-medium">撥款</th>}
              </tr>
            </thead>
            <tbody>
              {model.months.map((row) => {
                const selected = detail.kind === 'month' && detail.month === row.month
                const incomplete = cafeExpenseIncomplete(row.month, scope)
                return (
                  <tr
                    key={row.month}
                    className={cn('cursor-pointer border-t border-line', selected && 'bg-paper-2', incomplete && 'bg-laya-soft/60')}
                    onClick={() => props.onDetail({ kind: 'month', month: row.month })}
                  >
                    <th className="py-2.5 pr-3 font-medium">
                      {monthLabel(row.month)}
                      {incomplete && (
                        <span className="mt-1 block text-xs font-semibold text-expense">{INCOMPLETE_EXPENSE_NOTE}</span>
                      )}
                    </th>
                    <td className="num py-2.5 text-right">{formatTwd(row.income)}</td>
                    {showTender && <td className="num py-2.5 text-right text-income">{formatTwd(row.cash)}</td>}
                    {showTender && <td className="num py-2.5 text-right text-linepay">{formatTwd(row.linePay)}</td>}
                    <td className="num py-2.5 text-right text-expense">{formatTwd(row.expense)}</td>
                    <td className={cn('num py-2.5 text-right font-semibold', row.net >= 0 ? 'text-income' : 'text-expense')}>
                      {formatTwd(row.net)}
                    </td>
                    {showTender && <td className="num py-2.5 text-right text-muted">{formatTwd(row.settlements)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">點一個月，下面的分類和廠商會跟著變。</p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-4 md:p-5">
        <h3 className="font-semibold">月趨勢</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.months.map((row) => ({ label: monthLabel(row.month), 收入: row.income, 支出: row.expense }))}>
              <CartesianGrid vertical={false} stroke="#e0d3c0" />
              <XAxis dataKey="label" tick={{ fill: '#6b5d52', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(value: number) => compactTwd(value)}
                width={52}
                tick={{ fill: '#6b5d52', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(36,28,22,0.04)' }}
                contentStyle={{ background: '#fbf7f0', border: '1px solid #e0d3c0', borderRadius: 12 }}
                formatter={(value, name) => [`${formatTwd(Number(value ?? 0))} 元`, String(name)]}
              />
              <Bar dataKey="收入" fill="#1b6b43" radius={[4, 4, 0, 0]} />
              <Bar dataKey="支出" fill="#9c3424" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">支出分類 · {detailLabel}</h3>
              <p className="num mt-1 text-2xl text-expense">{formatTwd(model.detail.expense)}</p>
            </div>
            <div className="flex gap-2">
              <FilterChip active={detail.kind === 'ytd'} onClick={() => props.onDetail({ kind: 'ytd' })}>
                今年至今
              </FilterChip>
              <FilterChip
                active={detail.kind === 'month' && detail.month === today.monthKey}
                onClick={() => props.onDetail({ kind: 'month', month: today.monthKey })}
              >
                本月
              </FilterChip>
            </div>
          </div>
          {detail.kind === 'month' && cafeExpenseIncomplete(detail.month, scope) && (
            <p className="mt-2 text-sm font-medium text-expense">{INCOMPLETE_EXPENSE_NOTE}</p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={includePlanned}
              onChange={(event) => props.onIncludePlanned(event.target.checked)}
            />
            含計畫中的支出
          </label>
          <Bars
            rows={model.categories.map((slice) => ({ label: slice.name, amount: slice.amount }))}
            color="bg-expense"
            empty="這個範圍沒有支出。"
          />
          {model.detail.refundable > 0 && (
            <p className="mt-3 text-sm text-refund">可退押金另計 {formatTwd(model.detail.refundable)} 元，沒有算進上面的支出。</p>
          )}
          {model.detailFacts && <div className="mt-3"><FactsNote facts={model.detailFacts} /></div>}
        </section>

        {scope !== 'laya' && (
          <section className="rounded-2xl border border-line bg-card p-4 md:p-5">
            <h3 className="font-semibold">廠商進貨 · {detailLabel}</h3>
            <p className="mt-1 text-sm text-muted">只算諾奇意咖啡有填廠商的進貨。</p>
            <Bars
              rows={model.vendors.map((slice) => ({ label: slice.vendor, amount: slice.amount }))}
              color="bg-cafe"
              empty="這個範圍沒有廠商進貨。"
            />
            {model.goodsWithoutVendor > 0 && (
              <p className="mt-3 text-sm text-muted">另有未填廠商的食材支出 {formatTwd(model.goodsWithoutVendor)} 元（含匯款手續費）。</p>
            )}
          </section>
        )}
      </div>

      {vatPeriods.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4 md:p-5">
          <h3 className="font-semibold">預估營業稅</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            2026 年 11 月起諾奇意開統一發票，稅率 5%。應納稅額是銷項減進項，按單月（兩個月）一期。還沒逐筆填稅額的營收，先把每日金額當成含稅價估算；有填稅額的支出才算進項。撥款不算營業稅。
          </p>
          <div className="mt-4 space-y-4">
            {vatPeriods.map((period) => (
              <div key={period.start} className="rounded-xl bg-paper px-3 py-3">
                <p className="text-sm font-medium">{period.label}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Figure label={period.outputEstimated > 0 ? '銷項（含估算）' : '銷項'} value={period.output} tone="text-ink" />
                  <Figure label="進項" value={period.input} tone="text-ink" />
                  <Figure
                    label={period.payable >= 0 ? '預估應納' : '預估留抵'}
                    value={Math.abs(period.payable)}
                    tone={period.payable >= 0 ? 'text-expense' : 'text-income'}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">
                  已登錄銷項 {formatTwd(period.outputRecorded)} 元（{period.recordedIncomeCount} 筆），估算銷項{' '}
                  {formatTwd(period.outputEstimated)} 元（{period.estimatedIncomeCount} 筆），已登錄進項{' '}
                  {formatTwd(period.inputRecorded)} 元（{period.recordedExpenseCount} 筆）。
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {showTender && (model.ytd.settlements > 0 || model.thisMonth.settlements > 0) && (
        <section className="rounded-2xl border border-line bg-card p-4 md:p-5">
          <h3 className="font-semibold">Line Pay 撥款</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            撥款是 Line Pay 把已經算進營收的錢匯進戶頭，不是另一筆營業額。本月 {formatTwd(model.thisMonth.settlements)} 元，今年{' '}
            {formatTwd(model.ytd.settlements)} 元。
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {model.months
              .filter((row) => row.settlements > 0)
              .map((row) => (
                <li key={row.month} className="flex justify-between gap-3">
                  <span>{monthLabel(row.month)}</span>
                  <span className="num">{formatTwd(row.settlements)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {scope === 'all' && model.startup && (
        <StartupCard summary={model.startup} onEdit={props.onEdit} onOpenSettings={props.onOpenSettings} />
      )}

      <Recent records={snapshot.records} businesses={snapshot.businesses} scope={scope} onEdit={props.onEdit} onCreate={props.onCreate} />
    </div>
  )
}

function Kpi({
  label,
  totals,
  showTender,
  note,
}: {
  label: string
  totals: Totals
  showTender: boolean
  note?: string
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h3 className="text-sm text-muted">{label}</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Figure label="收入" value={totals.income} tone="text-income" />
        <Figure label="支出" value={totals.expense} tone="text-expense" />
        <Figure label="淨額" value={totals.net} tone={totals.net >= 0 ? 'text-income' : 'text-expense'} />
      </div>
      {showTender && totals.income > 0 && (
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-linepay/15">
            <div className="h-full bg-income" style={{ width: `${(totals.cash / (totals.cash + totals.linePay || 1)) * 100}%` }} />
            <div className="h-full flex-1 bg-linepay" />
          </div>
          <p className="mt-2 text-sm text-muted">
            營業額現金 <span className="num text-income">{formatTwd(totals.cash)}</span>
            {' · '}
            Line Pay <span className="num text-linepay">{formatTwd(totals.linePay)}</span>
            {totals.otherIncome > 0 && (
              <>
                {' · '}
                其他收入 <span className="num text-ink">{formatTwd(totals.otherIncome)}</span>
              </>
            )}
          </p>
        </div>
      )}
      {note && <p className="mt-3 text-sm font-medium text-expense">{note}</p>}
      {totals.plannedExpense + totals.plannedRefundable > 0 && (
        <p className="mt-2 text-sm text-planned">
          另有計畫支出 {formatTwd(totals.plannedExpense)} 元
          {totals.plannedRefundable > 0 ? `，計畫中的可退 ${formatTwd(totals.plannedRefundable)} 元` : ''}
          ，沒有算進上面的淨額。
        </p>
      )}
    </section>
  )
}

function Figure({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('num mt-1 text-xl md:text-2xl', tone)}>{formatTwd(value)}</p>
    </div>
  )
}

function FactsNote({ facts }: { facts: MonthFacts }) {
  const parts: string[] = []
  if (facts.closed.length > 0) parts.push(`公休 ${formatDayList(facts.closed)}`)
  if (facts.gaps.length > 0) parts.push(`來源沒有 ${formatDayList(facts.gaps)}，尚未登錄`)
  if (facts.missing.length > 0) parts.push(`尚未登錄 ${formatDayList(facts.missing)}`)
  if (parts.length === 0) return null
  return <p className="text-sm leading-6 text-muted">{parts.join('。')}。</p>
}

function StartupCard({
  summary,
  onEdit,
  onOpenSettings,
}: {
  summary: StartupSummary
  onEdit: (id: string) => void
  onOpenSettings: () => void
}) {
  return (
    <section className="rounded-2xl border border-laya/30 bg-laya-soft p-4 md:p-5">
      <h3 className="font-semibold">拉亞漢堡 · 創業投入</h3>
      <p className="mt-1 text-sm leading-6 text-muted">合約由合夥人簽署。可退的押金和保證金跟已經花掉的錢分開算。</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="已投入（已付）" value={summary.invested} tone="text-ink" />
        <Figure label="尚未支付" value={summary.plannedUnpaid} tone="text-planned" />
        <Figure label="其中可退" value={summary.plannedRefundable + summary.paidRefundable} tone="text-refund" />
        <Figure label="不含可退的預估" value={summary.estimatedSunk} tone="text-ink" />
      </div>
      <p className="mt-3 text-sm text-muted">含可退的總額 {formatTwd(summary.estimatedAll)} 元。</p>
      <div className="mt-4 rounded-xl bg-card/80 p-3">
        {summary.sharePercent === null ? (
          <p className="text-sm">
            持股比例尚未決定。
            <button type="button" className="ml-2 underline" onClick={onOpenSettings}>
              到設定填寫
            </button>
          </p>
        ) : (
          <p className="text-sm">
            依持股 {summary.sharePercent}% ，不含可退約{' '}
            <span className="num text-lg">{formatTwd(summary.shareOfSunk ?? 0)}</span> 元
            {summary.shareOfRefundable !== null && summary.shareOfRefundable > 0
              ? `；可退部分約 ${formatTwd(summary.shareOfRefundable)} 元`
              : ''}
            。
          </p>
        )}
      </div>
      {summary.pending.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">金額還沒定</p>
          <ul className="mt-2 space-y-1">
            {summary.pending.map((item) => (
              <li key={item.id}>
                <button type="button" className="text-sm underline decoration-line" onClick={() => onEdit(item.id)}>
                  {item.note}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Bars({ rows, color, empty }: { rows: { label: string; amount: number }[]; color: string; empty: string }) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-muted">{empty}</p>
  const max = Math.max(...rows.map((row) => row.amount))
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{row.label}</span>
            <span className="num">{formatTwd(row.amount)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-paper-2">
            <div className={cn('h-2 rounded-full', color)} style={{ width: `${(row.amount / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Recent({
  records,
  businesses,
  scope,
  onEdit,
  onCreate,
}: {
  records: LedgerRecord[]
  businesses: LedgerSnapshot['businesses']
  scope: Scope
  onEdit: (id: string) => void
  onCreate: () => void
}) {
  const rows = records
    .filter((record) => scope === 'all' || record.businessId === scope)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 6)
  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">最近紀錄</h3>
        <button type="button" className="text-sm underline" onClick={onCreate}>
          記一筆
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">這個範圍還沒有紀錄。</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
          {rows.map((record) => {
            const category = findCategory(businesses, record.categoryId)
            return (
              <li key={record.id}>
                <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => onEdit(record.id)}>
                  <span>
                    <span className="text-sm text-muted">{formatShortDate(record.date)}</span>
                    <span className="mt-0.5 block">{record.vendor || record.note || category?.name}</span>
                  </span>
                  <span className={cn('num', record.type === 'income' ? 'text-income' : 'text-expense')}>
                    {formatTwd(record.amount)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('h-9 rounded-lg px-3 text-sm', active ? 'bg-ink text-paper' : 'text-muted')}
    >
      {children}
    </button>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-9 rounded-lg border px-3 text-sm', active ? 'border-ink bg-ink text-paper' : 'border-line')}
    >
      {children}
    </button>
  )
}
