'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AutosaveQueue } from '@/lib/studio/autosave-queue'

export function useAutosave<T extends object>({
  storageKey,
  initial,
  save,
  onRestore,
}: {
  storageKey: string
  initial: T
  save: (value: T) => Promise<void>
  onRestore: (value: T) => void
}) {
  const router = useRouter()
  const [queue] = useState(() => new AutosaveQueue(initial, save))
  const [restore] = useState(() => onRestore)
  const [base] = useState(() => JSON.stringify(initial))
  const [shape] = useState(() => initial)
  const status = useSyncExternalStore(queue.subscribe, queue.getStatus, () => 'saved' as const)

  useEffect(() => {
    const persist = () => {
      try {
        if (queue.isDirty()) {
          sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, base, value: queue.getValue() }))
        } else {
          sessionStorage.removeItem(storageKey)
        }
      } catch { /* Storage can be disabled; server saving still works. */ }
    }
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const draft = JSON.parse(raw) as { version?: number; base?: string; value?: T }
        if (draft.version === 1 && draft.base === base && draft.value && typeof draft.value === 'object' &&
            Object.keys(shape).every(key => typeof draft.value?.[key as keyof T] === typeof shape[key as keyof T])) {
          queue.update(draft.value)
          restore(queue.getValue())
          toast.info('Восстановлены несохранённые правки')
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
  }, [queue, storageKey, base, shape, restore, router])

  return { update: queue.update, flush: queue.flush, status }
}
