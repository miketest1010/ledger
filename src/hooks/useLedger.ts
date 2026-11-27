import { useCallback, useEffect, useMemo, useState } from 'react'
import { getRepository } from '@/lib/storage/index.ts'
import type { Business, LedgerRecord, LedgerSnapshot } from '@/lib/types.ts'

export function useLedger() {
  const repo = useMemo(() => getRepository(), [])
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const loaded = await repo.load()
    setSnapshot(loaded)
    setError(null)
  }, [repo])

  useEffect(() => {
    let cancelled = false
    repo
      .load()
      .then((loaded) => {
        if (!cancelled) {
          setSnapshot(loaded)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('讀不到這台瀏覽器裡的帳簿。請改用支援 IndexedDB 的瀏覽器，或清除這個網站的資料後再試。')
        }
      })
    return () => {
      cancelled = true
    }
  }, [repo])

  const saveRecord = useCallback(
    async (record: LedgerRecord) => {
      await repo.saveRecord(record)
      await refresh()
    },
    [refresh, repo],
  )

  const deleteRecord = useCallback(
    async (id: string) => {
      await repo.deleteRecord(id)
      await refresh()
    },
    [refresh, repo],
  )

  const saveBusiness = useCallback(
    async (business: Business) => {
      await repo.saveBusiness(business)
      await refresh()
    },
    [refresh, repo],
  )

  const replaceAll = useCallback(
    async (next: LedgerSnapshot) => {
      await repo.replaceAll(next)
      await refresh()
    },
    [refresh, repo],
  )

  const clearSeed = useCallback(async () => {
    const removed = await repo.clearSeed()
    await refresh()
    return removed
  }, [refresh, repo])

  const restoreSeed = useCallback(async () => {
    const added = await repo.restoreSeed()
    await refresh()
    return added
  }, [refresh, repo])

  return { snapshot, error, saveRecord, deleteRecord, saveBusiness, replaceAll, clearSeed, restoreSeed }
}
