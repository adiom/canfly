'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AutosaveQueue, autosavePatch } from '@/lib/studio/autosave-queue'

export function useAutosave<T extends object>({
  storageKey,
  initial,
  save,
  onRestore,
  getRevision,
}: {
  storageKey: string
  initial: T
  save: (value: T, patch: Partial<T>) => Promise<void>
  onRestore: (value: T) => void
  getRevision?: () => number
}) {
  const router = useRouter()
  const [queue] = useState(() => new AutosaveQueue(initial, save))
  const [restore] = useState(() => onRestore)
  const [base] = useState(() => JSON.stringify(initial))
  const [shape] = useState(() => initial)
  const status = useSyncExternalStore(queue.subscribe, queue.getStatus, () => 'saved' as const)

  useEffect(() => {
    let keepExistingDraft = false
    const persist = () => {
      try {
        if (queue.isDirty()) {
          sessionStorage.setItem(storageKey, JSON.stringify({
            version: 1,
            base: getRevision ? JSON.stringify(queue.getSavedValue()) : base,
            revision: getRevision?.(),
            value: queue.getValue(),
          }))
          keepExistingDraft = false
        } else if (!keepExistingDraft) {
          sessionStorage.removeItem(storageKey)
        }
      } catch { /* Storage can be disabled; server saving still works. */ }
    }
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const draft = JSON.parse(raw) as { version?: number; base?: string; revision?: number; value?: T }
        const matchesBase = getRevision
          ? (draft.revision ?? 0) === getRevision() &&
            (draft.revision !== undefined || draft.base === base)
          : draft.base === base
        if (draft.version === 1 && draft.base && draft.value && typeof draft.value === 'object' &&
            Object.keys(shape).every(key => typeof draft.value?.[key as keyof T] === typeof shape[key as keyof T])) {
          if (matchesBase) {
            const patch = getRevision ? autosavePatch(JSON.parse(draft.base) as T, draft.value) : draft.value
            queue.update(patch)
            restore(queue.getValue())
            toast.info('Восстановлены несохранённые правки')
          } else if (getRevision) {
            keepExistingDraft = true
            toast.warning('Локальный черновик относится к старой версии главы.')
          }
        }
      }
    } catch { /* Ignore invalid local drafts. */ }
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
  }, [queue, storageKey, base, shape, restore, router, getRevision])

  return { update: queue.update, flush: queue.flush, reset: queue.reset, status }
}
