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
  type ChapterLeaseHolderView,
  type ChapterLeaseProof,
  type ChapterLeaseState,
  type ChapterLeaseView,
} from '@/lib/studio/chapter-lease'

const SESSION_KEY = 'cf-editor-session-id'
const SESSION_CHANNEL = 'cf-editor-sessions'

/**
 * Идентификатор вкладки. sessionStorage переживает перезагрузку (вкладка
 * возвращает своё право), а BroadcastChannel отлавливает дубликат вкладки:
 * браузер копирует sessionStorage при duplicate tab, и без проверки две
 * вкладки считались бы одной сессией.
 */
async function resolveSessionId(): Promise<string> {
  const existing = sessionStorage.getItem(SESSION_KEY)
  let id = existing ?? crypto.randomUUID()
  if (!existing) sessionStorage.setItem(SESSION_KEY, id)

  if (typeof BroadcastChannel === 'undefined') return id
  const channel = new BroadcastChannel(SESSION_CHANNEL)
  try {
    const duplicate = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 80)
      channel.onmessage = (event) => {
        const data = event.data as { type?: string; id?: string } | null
        if (!data || data.id !== id) return
        if (data.type === 'probe') channel.postMessage({ type: 'ack', id })
        if (data.type === 'ack') {
          clearTimeout(timer)
          resolve(true)
        }
      }
      channel.postMessage({ type: 'probe', id })
    })
    if (duplicate) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
  } finally {
    channel.close()
  }
  return id
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
  const sessionRef = useRef<string | null>(null)
  const heldRef = useRef(false)
  const callbacks = useRef({ onAcquired, onLost })
  useEffect(() => {
    callbacks.current = { onAcquired, onLost }
  }, [onAcquired, onLost])

  const sessionId = useCallback(async () => {
    if (!sessionRef.current) sessionRef.current = await resolveSessionId()
    return sessionRef.current
  }, [])

  const markLost = useCallback((holder: ChapterLeaseHolderView | null) => {
    leaseRef.current = null
    heldRef.current = false
    setState({ status: 'lost', holder })
    callbacks.current.onLost?.()
  }, [])

  const acquire = useCallback(async () => {
    try {
      const id = await sessionId()
      const acquired = await acquireChapterLeaseAction(chapterId, id)
      if (acquired.ok) {
        const wasHeld = heldRef.current
        leaseRef.current = acquired.lease
        heldRef.current = true
        setState({ status: 'active', lease: acquired.lease, degraded: false })
        // Повторный захват после простоя: страница должна перечитать снимок.
        if (!wasHeld) callbacks.current.onAcquired?.(acquired.lease)
        return
      }

      if (heldRef.current) {
        markLost(acquired.holder)
        return
      }
      setState({ status: 'read-only', holder: acquired.holder })
    } catch {
      if (heldRef.current) {
        setState(previous => previous.status === 'active' ? { ...previous, degraded: true } : previous)
      } else {
        setState({ status: 'error', message: 'Не удалось проверить право редактирования' })
      }
    }
  }, [chapterId, markLost, sessionId])

  useEffect(() => {
    void acquire()
  }, [acquire])

  useEffect(() => {
    if (state.status !== 'active') return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const proof = toLeaseProof(leaseRef.current)
      if (!proof) return
      void (async () => {
        const renewed = await renewChapterLeaseAction(chapterId, proof.sessionId, proof)
        if (renewed.ok) {
          leaseRef.current = renewed.lease
          setState({ status: 'active', lease: renewed.lease, degraded: false })
          return
        }
        if (renewed.code === 'lease-lost') {
          markLost(null)
          return
        }
        setState(previous => previous.status === 'active' ? { ...previous, degraded: true } : previous)
      })()
    }, CHAPTER_LEASE_HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [state.status, chapterId, markLost])

  useEffect(() => {
    if (state.status !== 'read-only' && state.status !== 'lost') return
    const retry = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    const timer = setInterval(retry, CHAPTER_LEASE_RETRY_MS)
    document.addEventListener('visibilitychange', retry)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [state.status, acquire])

  useEffect(() => {
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
    const onPageHide = () => release()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      release()
    }
  }, [chapterId])

  return {
    state,
    proof: state.status === 'active' ? toLeaseProof(state.lease) : null,
    reacquire: acquire,
  }
}
