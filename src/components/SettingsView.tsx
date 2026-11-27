import { useState } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { ConfirmDialog } from '@/components/ui/dialog.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { parseBackup, serializeBackup } from '@/lib/backup.ts'
import { importCsv, recordsToCsv } from '@/lib/csv.ts'
import { findBusiness } from '@/lib/defaults.ts'
import { formatPercent, parsePercent } from '@/lib/money.ts'
import type { Business, CategoryKind, LedgerSnapshot } from '@/lib/types.ts'
import { newId } from '@/lib/utils.ts'

interface SettingsProps {
  snapshot: LedgerSnapshot
  onSaveBusiness: (business: Business) => Promise<void>
  onReplaceAll: (snapshot: LedgerSnapshot) => Promise<void>
  onClearSeed: () => Promise<number>
  onNotify: (message: string) => void
}

export function SettingsView({ snapshot, onSaveBusiness, onReplaceAll, onClearSeed, onNotify }: SettingsProps) {
  const laya = findBusiness(snapshot.businesses, 'laya')
  const [pendingJson, setPendingJson] = useState<LedgerSnapshot | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  function download(filename: string, text: string, type: string) {
    const blob = new Blob([text], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onFile(file: File) {
    const text = (await file.text()).replace(/^\uFEFF/, '')
    const trimmed = text.trim()
    if (trimmed.startsWith('{')) {
      const parsed = parseBackup(trimmed)
      if (!parsed.ok) {
        onNotify(parsed.error)
        return
      }
      setPendingJson(parsed.snapshot)
      return
    }
    const imported = importCsv(text, snapshot)
    if (imported.records.length === 0) {
      onNotify(imported.errors[0] ?? '沒有讀到紀錄')
      return
    }
    const byId = new Map(snapshot.records.map((record) => [record.id, record]))
    for (const record of imported.records) byId.set(record.id, record)
    await onReplaceAll({ ...snapshot, records: [...byId.values()] })
    const suffix = imported.errors.length > 0 ? `，略過 ${imported.errors.length} 行` : ''
    onNotify(`已匯入 ${imported.records.length} 筆${suffix}`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">設定</h2>
        <p className="mt-1 text-sm leading-6 text-muted">資料只存在這台瀏覽器。換電腦或清掉網站資料前，先匯出備份。</p>
      </div>

      {laya && (
        <ShareEditor
          key={formatPercent(laya.sharePercent) || 'blank'}
          business={laya}
          onSave={onSaveBusiness}
          onNotify={onNotify}
        />
      )}

      {snapshot.businesses.map((business) => (
        <CategoryEditor key={business.id} business={business} records={snapshot.records} onSave={onSaveBusiness} onNotify={onNotify} />
      ))}

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h3 className="font-semibold">備份</h3>
        <p className="text-sm leading-6 text-muted">JSON 含店別、分類、持股和全部紀錄。CSV 適合用試算表看，匯入時依編號更新或新增，不會刪掉檔案裡沒有的紀錄。</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => download(`雙店帳簿-${snapshot.records.length}.json`, serializeBackup(snapshot), 'application/json')}
          >
            匯出 JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => download(`雙店帳簿-${snapshot.records.length}.csv`, recordsToCsv(snapshot), 'text/csv;charset=utf-8')}
          >
            匯出 CSV
          </Button>
          <Label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-line bg-card px-4 text-sm">
            匯入檔案
            <input
              type="file"
              accept="application/json,text/csv,.json,.csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void onFile(file)
              }}
            />
          </Label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h3 className="font-semibold">起始資料</h3>
        <p className="text-sm leading-6 text-muted">
          這份網站沒有預先寫入的帳。若匯入的備份裡有標記為起始資料的紀錄，可以在這裡清掉，你自己加的會留下。目前 {snapshot.records.length} 筆。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => setConfirmClear(true)}>
            清除起始資料
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={pendingJson !== null}
        title="用這份 JSON 取代全部資料？"
        description="這台瀏覽器上的店別、分類、持股和紀錄會被檔案內容換掉。"
        confirmLabel="取代並匯入"
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingJson(null)
        }}
        onConfirm={() => {
          if (!pendingJson) return
          const next = pendingJson
          setPendingJson(null)
          void onReplaceAll(next).then(() => onNotify('已匯入 JSON 備份'))
        }}
      />
      <ConfirmDialog
        open={confirmClear}
        title="清除起始資料？"
        description="標記為起始資料的紀錄會刪除。你另外記的不會刪。"
        confirmLabel="清除"
        destructive
        onOpenChange={setConfirmClear}
        onConfirm={() => {
          setConfirmClear(false)
          void onClearSeed().then((removed) => onNotify(`已清除 ${removed} 筆起始資料`))
        }}
      />
    </div>
  )
}

function ShareEditor({
  business,
  onSave,
  onNotify,
}: {
  business: Business
  onSave: (business: Business) => Promise<void>
  onNotify: (message: string) => void
}) {
  const [share, setShare] = useState(formatPercent(business.sharePercent))
  const [shareError, setShareError] = useState('')

  async function saveShare() {
    const parsed = parsePercent(share)
    if (parsed === 'invalid') {
      setShareError('請留空，或填 0 到 100，最多兩位小數。')
      return
    }
    setShareError('')
    await onSave({ ...business, sharePercent: parsed })
    onNotify(parsed === null ? '持股比例已清空' : `持股比例已存成 ${parsed}%`)
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <h3 className="font-semibold">拉亞漢堡持股</h3>
      <p className="text-sm leading-6 text-muted">合約是合夥人簽的，比例還沒定就留白。填了之後，總覽會算出不含可退的應負擔金額。</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="share">持股比例（%）</Label>
          <Input
            id="share"
            inputMode="decimal"
            placeholder="尚未決定"
            value={share}
            onChange={(event) => setShare(event.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={() => void saveShare()}>儲存比例</Button>
      </div>
      {shareError && <p className="text-sm text-expense">{shareError}</p>}
    </section>
  )
}

function CategoryEditor({
  business,
  records,
  onSave,
  onNotify,
}: {
  business: Business
  records: LedgerSnapshot['records']
  onSave: (business: Business) => Promise<void>
  onNotify: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<string | null>(null)
  const [rename, setRename] = useState('')

  async function addCategory() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (business.categories.some((category) => category.name === trimmed)) {
      onNotify('已經有這個分類')
      return
    }
    await onSave({
      ...business,
      categories: [...business.categories, { id: newId('cat'), name: trimmed, kind }],
    })
    setName('')
    onNotify('已新增分類')
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <h3 className="font-semibold">{business.name}的分類</h3>
      <ul className="space-y-2">
        {business.categories.map((category) => {
          const used = records.some((record) => record.categoryId === category.id)
          return (
            <li key={category.id} className="flex flex-wrap items-center gap-2 text-sm">
              {editing === category.id ? (
                <>
                  <Input value={rename} onChange={(event) => setRename(event.target.value)} className="max-w-48" />
                  <Button
                    size="sm"
                    onClick={() => {
                      const trimmed = rename.trim()
                      if (!trimmed) return
                      void onSave({
                        ...business,
                        categories: business.categories.map((item) => (item.id === category.id ? { ...item, name: trimmed } : item)),
                      }).then(() => {
                        setEditing(null)
                        onNotify('已改名')
                      })
                    }}
                  >
                    完成
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-24">{category.name}</span>
                  <span className="text-muted">{kindLabel(category.kind)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(category.id)
                      setRename(category.name)
                    }}
                  >
                    改名
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (used) {
                        onNotify('這個分類還有紀錄，請先改到別的分類')
                        return
                      }
                      void onSave({
                        ...business,
                        categories: business.categories.filter((item) => item.id !== category.id),
                      }).then(() => onNotify('已刪除分類'))
                    }}
                  >
                    刪除
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} placeholder="新分類名稱" onChange={(event) => setName(event.target.value)} className="max-w-48" />
        <select
          className="h-11 rounded-xl border border-line bg-card px-3 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value as CategoryKind)}
        >
          <option value="income">收入</option>
          <option value="expense">支出</option>
          <option value="settlement">撥款</option>
        </select>
        <Button variant="outline" onClick={() => void addCategory()}>
          新增
        </Button>
      </div>
    </section>
  )
}

function kindLabel(kind: CategoryKind): string {
  if (kind === 'income') return '收入'
  if (kind === 'settlement') return '撥款'
  return '支出'
}
