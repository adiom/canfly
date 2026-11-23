'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
  isReadOnly,
  hasExtraDraft,
  persistExtraDraft,
}: {
  storageKey: string
  initial: T
  save: (value: T, patch: Partial<T>) => Promise<AutosaveResult<T>>
  onRestore: (value: T) => void
  getRevision?: () => number
  archiveDraft?: (value: T, revision: number) => boolean
  legacyStorageKey?: string
  isReadOnly?: () => boolean
  hasExtraDraft?: () => boolean
  persistExtraDraft?: () => boolean
}) {
  const router = useRouter()
  const [queue] = useState(() => new AutosaveQueue(initial, save))
  const [restore] = useState(() => onRestore)
  const [base] = useState(() => JSON.stringify(initial))
  const [shape] = useState(() => initial)
  const [blockedDraft, setBlockedDraft] = useState<T | null>(null)
  const retryArchiveRef = useRef<() => void>(() => {})
  const retryArchive = useCallback(() => retryArchiveRef.current(), [])
  const status = useSyncExternalStore(queue.subscribe, queue.getStatus, () => 'saved' as const)

  useEffect(() => {
    const unarchivedDrafts = new Map<string, { value: T; revision: number }>()
    const persist = () => {
      try {
        for (const [key, draft] of unarchivedDrafts) {
          if (archiveDraft?.(draft.value, draft.revision)) {
            sessionStorage.removeItem(key)
            unarchivedDrafts.delete(key)
            if (key === storageKey) setBlockedDraft(null)
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
    retryArchiveRef.current = persist
    const unsubscribe = queue.subscribe(persist)
    // Не разрешаем редактирование, если новый черновик занял бы место старого.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- читаем состояние хранилища после гидратации
    setBlockedDraft(unarchivedDrafts.get(storageKey)?.value ?? null)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const dirty = queue.isDirty()
      const mediaAtRisk = hasExtraDraft?.() && !persistExtraDraft?.()
      if (!dirty && !mediaAtRisk) return
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
    const visibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      persist()
      persistExtraDraft?.()
      if (!isReadOnly?.()) void queue.flush().catch(() => {})
    }
    const online = () => {
      if (!isReadOnly?.() && queue.isDirty()) void queue.flush().catch(() => {})
    }
    const navigate = (event: MouseEvent) => {
      if ((!queue.isDirty() && !hasExtraDraft?.()) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href)
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return
      event.preventDefault()
      event.stopPropagation()
      const target = `${url.pathname}${url.search}${url.hash}`
      const leaveWithDraft = () => {
        const archived = !queue.isDirty() || archiveDraft?.(queue.getValue(), getRevision?.() ?? 0)
        const mediaSaved = !hasExtraDraft?.() || persistExtraDraft?.()
        if (!archived || !mediaSaved) {
          const leave = window.confirm(
            'Не удалось сохранить черновик в браузере. Покинуть страницу без сохранения?',
          )
          if (!leave) return false
        }
        router.push(target)
        return true
      }

      // В режиме чтения сохранять на сервер некуда: сначала пробуем архив,
      // затем либо переходим, либо предупреждаем о потере.
      if (isReadOnly?.()) {
        persist()
        leaveWithDraft()
        return
      }
      void queue.flush().then(() => {
        leaveWithDraft()
      }).catch(() => {
        persist()
        if (!leaveWithDraft()) {
          toast.error('Не удалось сохранить правки. Повторите попытку перед переходом.')
        }
      })
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', visibilityChange)
    document.addEventListener('click', navigate, true)
    return () => {
      persist()
      persistExtraDraft?.()
      retryArchiveRef.current = () => {}
      unsubscribe()
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', visibilityChange)
      document.removeEventListener('click', navigate, true)
      // Also flush on browser Back. The queue survives component teardown.
      if (!isReadOnly?.()) void queue.flush().catch(() => {})
    }
  }, [queue, storageKey, base, shape, restore, router, getRevision, archiveDraft, legacyStorageKey, isReadOnly, hasExtraDraft, persistExtraDraft])

  return {
    update: queue.update, flush: queue.flush, reset: queue.reset, status,
    getValue: queue.getValue, isDirty: queue.isDirty,
    blockedDraft, retryArchive,
  }
}
