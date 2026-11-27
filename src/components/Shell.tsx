import { BookOpen, Plus, Settings, LayoutDashboard } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatTaipeiLong, type TaipeiDate } from '@/lib/dates.ts'
import type { Scope } from '@/lib/types.ts'
import { cn } from '@/lib/utils.ts'

export type RouteName = 'dashboard' | 'records' | 'settings' | 'edit'

interface ShellProps {
  scope: Scope
  onScope: (scope: Scope) => void
  route: RouteName
  onRoute: (route: RouteName) => void
  onCreate: () => void
  today: TaipeiDate
  flash: string | null
  children: ReactNode
}

const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: 'cafe', label: '諾奇意', hint: '諾奇意咖啡' },
  { id: 'laya', label: '拉亞', hint: '拉亞漢堡 新莊店' },
  { id: 'all', label: '兩店', hint: '兩店合計' },
]

export function Shell({ scope, onScope, route, onRoute, onCreate, today, flash, children }: ShellProps) {
  const accent = scope === 'cafe' ? 'bg-cafe' : scope === 'laya' ? 'bg-laya' : 'bg-both'
  const navActive = route === 'edit' ? 'records' : route

  return (
    <div className="min-h-screen">
      <div className={cn('h-1.5', accent)} />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-card px-4 py-6 md:flex">
        <p className="text-xs tracking-widest text-muted">台北時間</p>
        <p className="mt-1 text-sm">{formatTaipeiLong(today)}</p>
        <h1 className="mt-6 text-2xl font-semibold">雙店帳簿</h1>
        <p className="mt-1 text-sm leading-6 text-muted">諾奇意咖啡與拉亞漢堡新莊店</p>
        <nav className="mt-8 flex flex-col gap-1">
          <SideLink active={navActive === 'dashboard'} onClick={() => onRoute('dashboard')} icon={<LayoutDashboard size={18} />}>
            總覽
          </SideLink>
          <SideLink active={navActive === 'records'} onClick={() => onRoute('records')} icon={<BookOpen size={18} />}>
            紀錄
          </SideLink>
          <SideLink active={false} onClick={onCreate} icon={<Plus size={18} />}>
            記一筆
          </SideLink>
          <SideLink active={navActive === 'settings'} onClick={() => onRoute('settings')} icon={<Settings size={18} />}>
            設定
          </SideLink>
        </nav>
        <p className="mt-auto text-xs leading-5 text-muted">資料存在這台瀏覽器，不經伺服器。</p>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="md:hidden">
              <p className="text-xs text-muted">{formatTaipeiLong(today)}</p>
              <p className="text-lg font-semibold">雙店帳簿</p>
            </div>
            <div className="flex rounded-xl border border-line bg-card p-1" role="tablist" aria-label="店別">
              {SCOPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === item.id}
                  className={cn(
                    'h-10 rounded-lg px-3 text-sm md:px-4',
                    scope === item.id ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
                  )}
                  onClick={() => onScope(item.id)}
                >
                  <span className="md:hidden">{item.label}</span>
                  <span className="hidden md:inline">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </header>
        {flash && (
          <p className="mx-auto mt-4 max-w-6xl px-4 text-sm text-income md:px-8" role="status">
            {flash}
          </p>
        )}
        <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          <TabButton active={navActive === 'dashboard'} onClick={() => onRoute('dashboard')}>
            總覽
          </TabButton>
          <TabButton active={navActive === 'records'} onClick={() => onRoute('records')}>
            紀錄
          </TabButton>
          <button type="button" className="flex h-16 flex-col items-center justify-center text-sm font-medium" onClick={onCreate}>
            <Plus size={18} />
            記一筆
          </button>
          <TabButton active={navActive === 'settings'} onClick={() => onRoute('settings')}>
            設定
          </TabButton>
        </div>
      </nav>
    </div>
  )
}

function SideLink({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-11 items-center gap-2 rounded-xl px-3 text-left text-sm',
        active ? 'bg-ink text-paper' : 'hover:bg-paper-2',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-16 text-sm', active ? 'font-semibold text-ink' : 'text-muted')}
    >
      {children}
    </button>
  )
}
