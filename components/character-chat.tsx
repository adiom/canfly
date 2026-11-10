'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CHARACTER_CHAT_CONFIG } from '@/lib/ai/character-chat/config'
import { isChatRequestId, type CharacterTurnSnapshot } from '@/lib/ai/character-chat/turn-status'
import { CharacterChatClient, characterChatBackend } from '@/lib/chat/character-chat-client'
import {
  canRetryCharacterTurn,
  canStartCharacterTurn,
  characterLiveStatus,
  isCharacterTurnActive,
  shouldSendCharacterChatKey,
  shouldStickToChatBottom,
  type CharacterChatMessage,
} from '@/lib/chat/character-chat-state'

export type { CharacterChatMessage } from '@/lib/chat/character-chat-state'

interface CharacterChatProps {
  characterSlug: string
  characterName: string
  characterAvatar: string
  viewerId: string
  canGenerate: boolean
  statusMessage?: string
  initialMessages?: CharacterChatMessage[]
  initialTurn?: CharacterTurnSnapshot | null
  initialHistoryError?: string | null
}

export function CharacterChat({
  characterSlug, characterName, characterAvatar, viewerId, canGenerate,
  statusMessage, initialMessages = [], initialTurn = null, initialHistoryError = null,
}: CharacterChatProps) {
  const storageKey = `canfly:character-chat:${viewerId}:${characterSlug}:pending`
  const [client] = useState(() => new CharacterChatClient({
    backend: characterChatBackend(characterSlug),
    messages: initialMessages,
    lastTurn: initialTurn,
    historyError: initialHistoryError,
    canGenerate,
    remember: (requestId) => {
      try {
        // Только requestId, без текста переписки. Ключ изолирован по аккаунту
        // и персонажу; sessionStorage сохраняет reload, но не общую память.
        if (requestId) sessionStorage.setItem(storageKey, requestId)
        else sessionStorage.removeItem(storageKey)
      } catch { /* Запрещённый storage не должен ломать отправку. */ }
    },
  }))
  const state = useSyncExternalStore(client.subscribe, client.getState, client.getState)
  const fieldId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { client.setAvailable(canGenerate) }, [client, canGenerate])

  useEffect(() => {
    const detach = client.attach()
    let pending: string | null = null
    try { pending = sessionStorage.getItem(storageKey) } catch { /* unavailable */ }
    if (isChatRequestId(pending)) void client.check(pending)
    else if (initialTurn && initialTurn.status !== 'completed') void client.check(initialTurn.requestId)

    const interrupt = () => client.stop()
    const reconcile = () => { void client.check() }
    window.addEventListener('pagehide', interrupt)
    window.addEventListener('beforeunload', interrupt)
    window.addEventListener('pageshow', reconcile)
    window.addEventListener('online', reconcile)
    return () => {
      window.removeEventListener('pagehide', interrupt)
      window.removeEventListener('beforeunload', interrupt)
      window.removeEventListener('pageshow', reconcile)
      window.removeEventListener('online', reconcile)
      detach()
    }
  }, [client, initialTurn, storageKey])

  useEffect(() => {
    const page = rootRef.current?.closest<HTMLElement>('[data-character-chat-page]')
    const viewport = window.visualViewport
    if (!page || !viewport) return
    const resize = () => {
      // dvh не во всех мобильных браузерах учитывает виртуальную клавиатуру.
      // Масштабирование пальцами не переопределяет высоту страницы.
      if (viewport.scale === 1) page.style.setProperty('--chat-viewport-height', `${viewport.height}px`)
    }
    resize()
    viewport.addEventListener('resize', resize)
    return () => { viewport.removeEventListener('resize', resize); page.style.removeProperty('--chat-viewport-height') }
  }, [])

  const retryAt = Math.max(state.error?.retryAt ?? 0, state.turn?.snapshot?.retryAt ? Date.parse(state.turn.snapshot.retryAt) || 0 : 0)
  useEffect(() => {
    if (!retryAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [retryAt])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || !stickToBottom.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ top: container.scrollHeight, behavior: reduced || isCharacterTurnActive(state.turn) ? 'auto' : 'smooth' })
  }, [state.messages, state.turn])

  const phase = state.turn?.phase
  useEffect(() => {
    if (state.error || (phase && ['failed', 'cancelled', 'unsaved'].includes(phase))) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [state.error, phase])

  const turn = state.turn
  const accessDenied = state.error?.status === 401 || state.error?.status === 403
  const canSend = canGenerate && canStartCharacterTurn(state)
  const canStop = turn?.phase === 'sending' || turn?.phase === 'streaming'
  const localUser = turn?.text && !turn.snapshot?.userMessage
    ? { id: `local-${turn.requestId}`, role: 'user' as const, content: turn.text }
    : null
  const displayedMessages = localUser ? [...state.messages, localUser] : state.messages
  const liveStatus = state.historyStatus === 'loading' ? 'Загружаем историю…'
    : !canGenerate && !turn ? statusMessage : characterLiveStatus(turn)
  const pauseSeconds = Math.max(0, Math.ceil((retryAt - now) / 1000))

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={() => { if (scrollRef.current) stickToBottom.current = shouldStickToChatBottom(scrollRef.current) }}
        className="mb-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={`Переписка с ${characterName}`}
        tabIndex={0}
      >
        {displayedMessages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {message.role === 'assistant' ? <CharacterAvatar name={characterName} avatar={characterAvatar} /> : (
              <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cf-air-surface-2 text-xs text-cf-text-3">Я</div>
            )}
            <div className={`min-w-0 max-w-[calc(100%-3.25rem)] rounded-3xl px-4 py-3 sm:max-w-xl ${message.role === 'user'
              ? 'rounded-br-md bg-cf-air-accent text-cf-text-on-pastel' : 'cf-glass rounded-bl-md text-cf-text-2'}`}>
              <span className="sr-only">{message.role === 'user' ? 'Вы' : characterName}: </span>
              <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{message.content}</p>
              {message.id === localUser?.id ? <p className="mt-2 text-xs">Сохранение сообщения ещё не подтверждено</p> : null}
            </div>
          </div>
        ))}

        {turn?.partialText && turn.phase !== 'completed' ? (
          <div className="flex gap-3" aria-live="off">
            <CharacterAvatar name={characterName} avatar={characterAvatar} />
            <div className="cf-glass min-w-0 max-w-[calc(100%-3.25rem)] rounded-3xl rounded-bl-md border border-dashed border-cf-text-3 px-4 py-3 sm:max-w-xl">
              <p className="mb-2 text-xs font-medium text-cf-text-3">Черновик ответа · сохранение не подтверждено</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-cf-text-2 [overflow-wrap:anywhere]">{turn.partialText}</p>
              {!isCharacterTurnActive(turn) ? <p className="mt-2 text-xs text-cf-text-3">Фрагмент можно выделить и скопировать. Это не окончательный ответ персонажа.</p> : null}
            </div>
          </div>
        ) : null}

        {turn?.phase === 'sending' && !turn.partialText ? (
          <div aria-hidden="true" className="flex gap-2 py-3">
            {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-cf-live-on motion-reduce:animate-none" />)}
          </div>
        ) : null}

        {state.historyStatus === 'ready' && displayedMessages.length === 0 && !turn ? (
          <p className="py-6 text-[15px] leading-relaxed text-cf-text-3">
            {canGenerate ? `Разговор с ${characterName} ещё не начался. Напишите первое сообщение.` : statusMessage}
          </p>
        ) : null}
      </div>

      <div className="max-h-[75%] shrink-0 space-y-3 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p id={`${fieldId}-status`} role="status" aria-live="polite" aria-atomic="true" className="text-sm text-cf-text-3">{liveStatus}</p>
        {state.historyError ? (
          <div role="alert" className="rounded-2xl border border-cf-air-line bg-cf-air-surface p-3 text-sm text-cf-text-2">
            <p>{state.historyError}</p>
            <Button type="button" variant="outline" onClick={() => { void client.reloadHistory() }} className="mt-2 min-h-11">Загрузить историю снова</Button>
          </div>
        ) : null}
        {state.error ? (
          <div role="alert" className="rounded-2xl border border-cf-air-line bg-cf-air-surface p-3 text-sm text-cf-text-2">
            <p>{state.error.message}</p>
            {state.error.status === 401 ? <Link className="mt-2 inline-flex min-h-11 items-center text-cf-air-accent-ink underline" href={`/login?redirect=${encodeURIComponent(`/characters/${characterSlug}/chat`)}`}>Войти в canfly</Link> : null}
          </div>
        ) : null}

        {turn && !isCharacterTurnActive(turn) && turn.phase !== 'completed' ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={state.checking} onClick={() => { void client.check() }} className="min-h-11">Проверить статус</Button>
              {canGenerate && !accessDenied && canRetryCharacterTurn(turn) ? (
                <Button type="button" variant="outline" disabled={state.checking || pauseSeconds > 0} onClick={() => { void client.retry() }} className="min-h-11 whitespace-normal">
                  {pauseSeconds > 0 ? `Повтор через ${pauseSeconds} с` : 'Повторить ход'}
                </Button>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-cf-text-3">Проверка статуса не запускает AI. Явный повтор после проверки может вызвать новую платную генерацию.</p>
          </div>
        ) : null}

        {canGenerate ? (
          <form onSubmit={(event) => { event.preventDefault(); void client.submit() }} className="space-y-2">
            <label htmlFor={fieldId} className="block text-sm text-cf-text-2">Сообщение для {characterName}</label>
            <Textarea
              ref={inputRef}
              id={fieldId}
              value={state.input}
              onChange={(event) => client.setInput(event.target.value)}
              onKeyDown={(event) => {
                if (shouldSendCharacterChatKey({ ...event, isComposing: event.nativeEvent.isComposing })) {
                  event.preventDefault()
                  if (canSend) event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Напишите сообщение…"
              aria-label={`Сообщение для ${characterName}`}
              aria-describedby={`${fieldId}-help ${fieldId}-status`}
              maxLength={CHARACTER_CHAT_CONFIG.maxQuestionChars}
              readOnly={isCharacterTurnActive(turn)}
              disabled={state.historyStatus !== 'ready' || accessDenied}
              rows={2}
              className="max-h-40 resize-none overflow-y-auto rounded-2xl border-cf-air-line bg-cf-air-surface px-4 text-base text-cf-text-1 placeholder:text-cf-text-3 md:text-base"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id={`${fieldId}-help`} className="text-xs text-cf-text-3">Enter — отправить · Shift+Enter — новая строка</p>
              <div className="flex gap-2">
                {canStop ? <Button type="button" variant="outline" aria-label="Остановить получение ответа" onClick={() => { client.stop(); inputRef.current?.focus({ preventScroll: true }) }} className="min-h-11 rounded-full">Стоп</Button> : null}
                <Button type="submit" disabled={!canSend || !state.input.trim() || pauseSeconds > 0} className="min-h-11 rounded-full bg-cf-air-accent px-5 text-cf-text-on-pastel hover:bg-cf-air-accent/90">
                  {turn?.text === state.input.trim() && turn.phase !== 'completed' ? 'Повторить ход' : 'Отправить'}
                </Button>
              </div>
            </div>
          </form>
        ) : <p className="rounded-2xl border border-cf-air-line bg-cf-air-surface p-3 text-sm text-cf-text-3">{statusMessage}</p>}
      </div>
    </div>
  )
}

function CharacterAvatar({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div aria-hidden="true" className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2">
      {avatar ? (
        <Image src={avatar} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-medium uppercase text-cf-text-3">
          {name.slice(0, 1)}
        </div>
      )}
    </div>
  )
}
