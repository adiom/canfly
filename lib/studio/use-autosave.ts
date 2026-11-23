'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AutosaveQueue, autosavePatch, type AutosaveResult } from '@/lib/studio/autosave-queue'

export function useAutosave<T extends object>({
  storageKey,
  initial,
  save,
  onRestore,
  getRevision,
  archiveDraft,
  legacyStorageKey,
}: {
  storageKey: string
  initial: T
  save: (value: T, patch: Partial<T>) => Promise<AutosaveResult<T>>
  onRestore: (value: T) => void
  getRevision?: () => number
  archiveDraft?: (value: T, revision: number) => boolean
  legacyStorageKey?: string
}) {
  const router = useRouter()
  const [queue] = useState(() => new AutosaveQueue(initial, save))
  const [restore] = useState(() => onRestore)
  const [base] = useState(() => JSON.stringify(initial))
  const [shape] = useState(() => initial)
  const status = useSyncExternalStore(queue.subscribe, queue.getStatus, () => 'saved' as const)

  useEffect(() => {
    const unarchivedDrafts = new Map<string, { value: T; revision: number }>()
    const persist = () => {
      try {
        for (const [key, draft] of unarchivedDrafts) {
          if (archiveDraft?.(draft.value, draft.revision)) {
            sessionStorage.removeItem(key)
            unarchivedDrafts.delete(key)
          }
        }
        if (unarchivedDrafts.has(storageKey)) return
        if (queue.isDirty()) {
          sessionStorage.setItem(storageKey, JSON.stringify({
            version: 1,
            base: getRevision ? JSON.stringify(queue.getSavedValue()) : base,
            revision: getRevision?.(),
            value: queue.getValue(),
          }))
        } else {
          sessionStorage.removeItem(storageKey)
        }
      } catch { /* Storage can be disabled; server saving still works. */ }
    }
    for (const key of legacyStorageKey ? [legacyStorageKey, storageKey] : [storageKey]) {
      try {
        const raw = sessionStorage.getItem(key)
        if (!raw) continue
        const draft = JSON.parse(raw) as { version?: number; base?: string; revision?: number; value?: T }
        const matchesBase = getRevision
          ? (draft.revision ?? 0) === getRevision() &&
            (draft.revision !== undefined || draft.base === base)
          : draft.base === base
        if (draft.version === 1 && draft.base && draft.value && typeof draft.value === 'object' &&
            Object.keys(shape).every(key => typeof draft.value?.[key as keyof T] === typeof shape[key as keyof T])) {
          if (key === storageKey && matchesBase) {
            const patch = getRevision ? autosavePatch(JSON.parse(draft.base) as T, draft.value) : draft.value
            queue.update(patch)
            restore(queue.getValue())
            toast.info('Восстановлены несохранённые правки')
          } else if (getRevision) {
            const revision = draft.revision ?? 0
            if (archiveDraft?.(draft.value, revision)) {
              sessionStorage.removeItem(key)
            } else {
              unarchivedDrafts.set(key, { value: draft.value, revision })
            }
            const message = unarchivedDrafts.has(key)
              ? 'Браузер не смог перенести старый черновик в архив. Исходная копия сохранена в этой вкладке.'
              : 'Ранее сохранённый черновик доступен в разделе «Локальные черновики».'
            toast.warning(message)
          }
        }
      } catch { /* Ignore invalid local drafts. */ }
    }
    const unsubscribe = queue.subscribe(persist)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!queue.isDirty()) return
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
    const visibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persist()
        void queue.flush().catch(() => {})
      }
    }
    const navigate = (event: MouseEvent) => {
      if (!queue.isDirty() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href)
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return
      event.preventDefault()
      event.stopPropagation()
      void queue.flush().then(() => {
        router.push(`${url.pathname}${url.search}${url.hash}`)
      }).catch(() => { toast.error('Не удалось сохранить правки. Повторите попытку перед переходом.') })
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', visibilityChange)
    document.addEventListener('click', navigate, true)
    return () => {
      persist()
      unsubscribe()
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', visibilityChange)
      document.removeEventListener('click', navigate, true)
      // Also flush on browser Back. The queue survives component teardown.
      void queue.flush().catch(() => {})
    }
  }, [queue, storageKey, base, shape, restore, router, getRevision, archiveDraft, legacyStorageKey])

  return {
    update: queue.update, flush: queue.flush, reset: queue.reset, status,
    getValue: queue.getValue, isDirty: queue.isDirty,
  }
}
