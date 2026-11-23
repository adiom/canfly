'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acquireChapterLeaseAction,
  renewChapterLeaseAction,
} from '@/lib/actions/chapter-lease'
import {
  CHAPTER_LEASE_HEARTBEAT_MS,
  CHAPTER_LEASE_RETRY_MS,
  toLeaseProof,
  type ChapterLeaseProof,
  type ChapterLeaseState,
  type ChapterLeaseView,
} from '@/lib/studio/chapter-lease'
import { settleLeaseRenewal } from '@/lib/studio/chapter-lease-renewal'

const SESSION_KEY = 'cf-editor-session-id'
const SESSION_CHANNEL = 'cf-editor-sessions'
const SESSION_PROBE_TIMEOUT_MS = 150

/**
 * Идентификатор документа. Живёт только в памяти и не попадает в
 * sessionStorage, поэтому duplicate tab не может его унаследовать. Сервер
 * разрешает повторный захват живого lease только при совпадении
 * user + session + documentId; reload полагается на release при pagehide или TTL.
 */
const DOCUMENT_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `document-${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * Идентификатор вкладки. sessionStorage переживает перезагрузку (вкладка
 * возвращает своё право), а постоянно открытый BroadcastChannel отлавливает
 * дубликат вкладки: браузер копирует sessionStorage при duplicate tab, и без
 * проверки две вкладки считались бы одной сессией. Канал закрывается только
 * вместе с документом, поэтому дубликат, созданный позже, тоже получает ack.
 */
let currentSessionId: string | null = null
let sessionPromise: Promise<string> | null = null
let sessionChannel: BroadcastChannel | null = null

function tabChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!sessionChannel) {
    sessionChannel = new BroadcastChannel(SESSION_CHANNEL)
    sessionChannel.onmessage = (event) => {
      const data = event.data as { type?: string; id?: string } | null
      if (data?.type === 'probe' && data.id && data.id === currentSessionId) {
        sessionChannel?.postMessage({ type: 'ack', id: data.id })
      }
    }
  }
  return sessionChannel
}

async function resolveSessionId(): Promise<string> {
  const channel = tabChannel()
  let id = sessionStorage.getItem(SESSION_KEY) ?? crypto.randomUUID()
  sessionStorage.setItem(SESSION_KEY, id)
  currentSessionId = id

  if (!channel) return id

  const duplicate = await new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      channel.removeEventListener('message', onMessage)
      resolve(value)
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string } | null
      if (data?.type === 'ack' && data.id === id) finish(true)
    }
    const timer = setTimeout(() => finish(false), SESSION_PROBE_TIMEOUT_MS)
    channel.addEventListener('message', onMessage)
    channel.postMessage({ type: 'probe', id })
  })

  if (duplicate) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
    currentSessionId = id
  }
  return id
}

/** Один id на вкладку: StrictMode и повторные вызовы не создают новую сессию. */
function sharedSessionId() {
  sessionPromise ??= resolveSessionId()
  return sessionPromise
}

export interface ChapterLeaseController {
  state: ChapterLeaseState
  proof: ChapterLeaseProof | null
  reacquire: () => Promise<void>
}

/**
 * Держит lease вкладки: захват при открытии, heartbeat, повторный захват и
 * освобождение через beacon при закрытии. Состояние живёт только в памяти
 * вкладки; сервер сверяет токен и generation в каждой транзакции записи.
 */
export function useChapterLease({
  chapterId,
  onAcquired,
  onLost,
}: {
  chapterId: string
  onAcquired?: (lease: ChapterLeaseView) => void
  onLost?: () => void
}): ChapterLeaseController {
  const [state, setState] = useState<ChapterLeaseState>({ status: 'acquiring' })
  const leaseRef = useRef<ChapterLeaseView | null>(null)
  const heldRef = useRef(false)
  const reconcileRef = useRef(false)
  const lostNotifiedRef = useRef(false)
  const acquireInFlight = useRef<Promise<void> | null>(null)
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbacks = useRef({ onAcquired, onLost })
  useEffect(() => {
    callbacks.current = { onAcquired, onLost }
  }, [onAcquired, onLost])

  const notifyLost = useCallback(() => {
    if (lostNotifiedRef.current) return
    lostNotifiedRef.current = true
    callbacks.current.onLost?.()
  }, [])

  const acquire = useCallback(() => {
    if (acquireInFlight.current) return acquireInFlight.current

    const run = (async () => {
      try {
        const id = await sharedSessionId()
        const acquired = await acquireChapterLeaseAction(chapterId, id, DOCUMENT_ID)
        if (acquired.ok) {
          const reconcile = reconcileRef.current
          leaseRef.current = acquired.lease
          heldRef.current = true
          reconcileRef.current = false
          lostNotifiedRef.current = false
          setState({ status: 'active', lease: acquired.lease, degraded: false })
          if (reconcile) callbacks.current.onAcquired?.(acquired.lease)
          return
        }

        if (heldRef.current) notifyLost()
        leaseRef.current = null
        heldRef.current = false
        reconcileRef.current = true
        setState({ status: 'read-only', holder: acquired.holder })
      } catch {
        reconcileRef.current = true
        setState(previous => {
          if (previous.status === 'active' || previous.status === 'recovering' ||
              previous.status === 'read-only' || previous.status === 'lost') {
            return { status: 'recovering', holder: null }
          }
          return { status: 'error', message: 'Не удалось проверить право редактирования' }
        })
      }
    })()

    acquireInFlight.current = run
    void run.finally(() => {
      if (acquireInFlight.current === run) acquireInFlight.current = null
    })
    return run
  }, [chapterId, notifyLost])

  /**
   * Возврат из фона: сначала продлеваем текущий lease. Если он истёк или его
   * перехватили, сразу пробуем новый захват — только после неудачи показываем
   * read-only. На время попытки редактор уже read-only.
   */
  const recover = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    const proof = toLeaseProof(leaseRef.current)
    if (!proof) {
      await acquire()
      return
    }

    const outcome = await settleLeaseRenewal(
      () => renewChapterLeaseAction(chapterId, proof.sessionId, proof),
    )
    if (outcome.status === 'ok') {
      leaseRef.current = outcome.lease
      setState({ status: 'active', lease: outcome.lease, degraded: false })
      return
    }
    if (outcome.status === 'degraded') {
      setState(previous => previous.status === 'active' ? { ...previous, degraded: true } : previous)
      return
    }

    reconcileRef.current = true
    setState(previous => previous.status === 'active'
      ? { status: 'recovering', holder: null }
      : previous)
    await acquire()
  }, [acquire, chapterId])

  useEffect(() => {
    void acquire()
  }, [acquire])

  useEffect(() => {
    if (state.status !== 'active') return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void recover()
    }, CHAPTER_LEASE_HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [state.status, recover])

  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') void recover()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
    }
  }, [recover])

  useEffect(() => {
    if (state.status !== 'read-only' && state.status !== 'lost' && state.status !== 'recovering') return
    const retry = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    const timer = setInterval(retry, CHAPTER_LEASE_RETRY_MS)
    return () => clearInterval(timer)
  }, [state.status, acquire])

  useEffect(() => {
    // StrictMode в dev монтирует эффект дважды. Немедленный release в cleanup
    // освободил бы lease только что открытой вкладки; откладываем и отменяем
    // при повторном монтировании.
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current)
      releaseTimer.current = null
    }

    const release = () => {
      const current = leaseRef.current
      if (!current) return
      leaseRef.current = null
      heldRef.current = false
      try {
        const body = JSON.stringify({
          chapterId,
          sessionId: current.sessionId,
          proof: toLeaseProof(current),
        })
        navigator.sendBeacon(
          '/api/chapter-leases/release',
          new Blob([body], { type: 'application/json' }),
        )
      } catch {
        // TTL всё равно освободит главу.
      }
    }

    const onPageHide = () => {
      if (releaseTimer.current) {
        clearTimeout(releaseTimer.current)
        releaseTimer.current = null
      }
      release()
    }

    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = null
        release()
      }, 1_000)
    }
  }, [chapterId])

  return {
    state,
    proof: state.status === 'active' ? toLeaseProof(state.lease) : null,
    reacquire: acquire,
  }
}
