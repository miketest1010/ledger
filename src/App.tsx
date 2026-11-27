import { useEffect, useMemo, useState } from 'react'
import { CompareView } from '@/components/CompareView.tsx'
import { Dashboard } from '@/components/Dashboard.tsx'
import { RecordForm } from '@/components/RecordForm.tsx'
import { RecordList } from '@/components/RecordList.tsx'
import { SettingsView } from '@/components/SettingsView.tsx'
import { Shell, type RouteName } from '@/components/Shell.tsx'
import { blankDraft, draftFromRecord, type Draft } from '@/lib/draft.ts'
import { taipeiToday } from '@/lib/dates.ts'
import { useLedger } from '@/hooks/useLedger.ts'
import type { DetailRange } from '@/lib/aggregate.ts'
import { accountingMonths } from '@/lib/months.ts'
import type { LedgerMode, LedgerRecord, Scope } from '@/lib/types.ts'

function resolveFocusMonth(choice: string | null | undefined, months: string[]): string | null {
  if (choice && months.includes(choice)) return choice
  if (choice === null) return null
  return months[0] ?? null
}

function readScope(): Scope {
  const saved = localStorage.getItem('shuangdian-scope')
  return saved === 'laya' || saved === 'all' || saved === 'cafe' ? saved : 'cafe'
}

export default function App() {
  const ledger = useLedger()
  const today = useMemo(() => taipeiToday(), [])
  const [route, setRoute] = useState<RouteName>('dashboard')
  const [scope, setScope] = useState<Scope>(readScope)
  const [mode, setMode] = useState<LedgerMode>('accounting')
  const [focusChoice, setFocusChoice] = useState<string | null | undefined>(undefined)
  const [includePlanned, setIncludePlanned] = useState(false)
  const [excludeOneOff, setExcludeOneOff] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const monthsInScope = useMemo(
    () => (ledger.snapshot ? accountingMonths(ledger.snapshot.records, scope) : []),
    [ledger.snapshot, scope],
  )
  const focusMonth = resolveFocusMonth(focusChoice, monthsInScope)
  const detail: DetailRange = focusMonth ? { kind: 'month', month: focusMonth } : { kind: 'ytd' }

  useEffect(() => {
    localStorage.setItem('shuangdian-scope', scope)
  }, [scope])

  function notify(message: string) {
    setFlash(message)
    window.setTimeout(() => setFlash(null), 3200)
  }

  function openNew() {
    if (!ledger.snapshot) return
    const businessId = scope === 'all' ? 'cafe' : scope
    setDraft(blankDraft(businessId, today, ledger.snapshot.businesses))
    setRoute('edit')
  }

  function openEdit(id: string) {
    const record = ledger.snapshot?.records.find((item) => item.id === id)
    if (!record) return
    setDraft(draftFromRecord(record))
    setRoute('edit')
  }

  async function save(record: LedgerRecord) {
    await ledger.saveRecord(record)
    notify('已儲存')
    setRoute('records')
    setDraft(null)
  }

  let body = null
  if (ledger.error) {
    body = <p className="text-sm text-expense">{ledger.error}</p>
  } else if (!ledger.snapshot) {
    body = <p className="text-sm text-muted">正在打開帳簿…</p>
  } else if (route === 'dashboard') {
    body = (
      <Dashboard
        snapshot={ledger.snapshot}
        scope={scope}
        mode={mode}
        onMode={setMode}
        detail={detail}
        onDetail={(next) => setFocusChoice(next.kind === 'month' ? next.month : null)}
        includePlanned={includePlanned}
        onIncludePlanned={setIncludePlanned}
        excludeOneOff={excludeOneOff}
        onExcludeOneOff={setExcludeOneOff}
        onEdit={openEdit}
        onCreate={openNew}
        onOpenSettings={() => setRoute('settings')}
        onOpenCompare={() => setRoute('compare')}
        today={today}
      />
    )
  } else if (route === 'compare') {
    body = <CompareView snapshot={ledger.snapshot} scope={scope} preferredMonth={focusMonth ?? null} />
  } else if (route === 'records') {
    body = (
      <RecordList
        snapshot={ledger.snapshot}
        scope={scope}
        month={focusMonth ?? 'all'}
        onMonth={(month) => setFocusChoice(month === 'all' ? null : month)}
        onEdit={openEdit}
        onCreate={openNew}
      />
    )
  } else if (route === 'settings') {
    body = (
      <SettingsView
        snapshot={ledger.snapshot}
        onSaveBusiness={ledger.saveBusiness}
        onReplaceAll={ledger.replaceAll}
        onClearSeed={ledger.clearSeed}
        onNotify={notify}
      />
    )
  } else if (draft) {
    body = (
      <RecordForm
        draft={draft}
        businesses={ledger.snapshot.businesses}
        onChange={setDraft}
        onSave={(record) => void save(record)}
        onDelete={(id) => {
          void ledger.deleteRecord(id).then(() => {
            notify('已刪除')
            setRoute('records')
            setDraft(null)
          })
        }}
        onCancel={() => setRoute('records')}
      />
    )
  }

  return (
    <Shell
      scope={scope}
      onScope={setScope}
      route={route}
      onRoute={setRoute}
      onCreate={openNew}
      today={today}
      flash={flash}
    >
      {body}
    </Shell>
  )
}
