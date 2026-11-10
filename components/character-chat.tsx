'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import { useRef, useEffect, useState } from 'react'
import { readTextStream } from '@/lib/chat/read-text-stream'
import { CHARACTER_CHAT_CONFIG } from '@/lib/ai/character-chat/config'

export interface CharacterChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CharacterChatProps {
  characterSlug: string
  characterName: string
  characterAvatar: string
  /** Может ли персонаж отвечать сейчас. `false` — история только для чтения. */
  canGenerate: boolean
  /** Объяснение, почему нельзя написать. Показывается вместо поля ввода. */
  statusMessage?: string
  /** История, уже прочитанная сервером. Клиент её не перезапрашивает. */
  initialMessages?: CharacterChatMessage[]
}

function greetingFor(characterName: string): CharacterChatMessage {
  return {
    id: 'greeting',
    role: 'assistant',
    content: `Привет! Я ${characterName}. Рад(а) познакомиться с тобой. Хочешь узнать больше о мне, о нашей вселенной или просто поговорить?`,
  }
}

/** Ошибку сервер отдаёт JSON-ом; сеть может отдать что угодно. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const { error } = payload as { error?: unknown }
      if (typeof error === 'string' && error.trim()) return error
    }
  } catch {
    // ignore: ниже общий текст
  }

  if (response.status === 429) return 'Слишком много сообщений. Попробуйте позже.'
  if (response.status === 401) return 'Войдите, чтобы продолжить разговор.'
  return 'Не удалось получить ответ. Попробуйте ещё раз.'
}

export function CharacterChat({
  characterSlug,
  characterName,
  characterAvatar,
  canGenerate,
  statusMessage,
  initialMessages = [],
}: CharacterChatProps) {
  const [messages, setMessages] = useState<CharacterChatMessage[]>(() => {
    if (initialMessages.length > 0) return initialMessages
    return canGenerate ? [greetingFor(characterName)] : []
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  // Повтор того же текста после сбоя переиспользует requestId: сервер
  // продолжит неудачный ход, а не создаст вторую реплику с тем же вопросом.
  const lastAttemptRef = useRef<{ text: string; requestId: string } | null>(null)

  useEffect(() => {
    // Не дёргаем чтение выше: автопрокрутка только если читатель уже внизу.
    if (!stickToBottomRef.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    messagesEndRef.current?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [messages, isLoading])

  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    stickToBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const text = input.trim()
    if (!text || isLoading || !canGenerate) return

    // requestId делает повтор безопасным: тот же ход не спишет лимит второй раз
    // и не запустит модель, а сервер вернёт уже сохранённый ответ.
    const previous = lastAttemptRef.current
    const requestId = previous?.text === text ? previous.requestId : crypto.randomUUID()
    lastAttemptRef.current = { text, requestId }
    const userMessageId = `user-${requestId}`
    const assistantMessageId = `character-${requestId}`

    setMessages((prev) =>
      prev.some((message) => message.id === userMessageId)
        ? prev
        : [...prev, { id: userMessageId, role: 'user', content: text }],
    )
    setInput('')
    setError(null)
    setIsLoading(true)

    let received = ''

    try {
      const response = await fetch('/api/characters/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterSlug, message: text, requestId }),
      })

      if (!response.ok) {
        setError(await readErrorMessage(response))

        // 4xx — ход не сохранён, поэтому убираем оптимистичную реплику и
        // возвращаем текст в поле. 429 и 5xx оставляем: вопрос уже записан.
        if (response.status < 500 && response.status !== 429) {
          setMessages((prev) => prev.filter((message) => message.id !== userMessageId))
          setInput((current) => (current ? current : text))
          lastAttemptRef.current = null
        }
        return
      }

      if (!response.body) {
        setError('Сервер не прислал ответ. Попробуйте ещё раз.')
        setMessages((prev) => prev.filter((message) => message.id !== userMessageId))
        return
      }

      for await (const chunk of readTextStream(response.body)) {
        received += chunk
        const content = received

        setMessages((prev) => {
          const exists = prev.some((message) => message.id === assistantMessageId)
          if (exists) {
            return prev.map((message) =>
              message.id === assistantMessageId ? { ...message, content } : message,
            )
          }
          return [...prev, { id: assistantMessageId, role: 'assistant', content }]
        })
      }

      if (!received.trim()) {
        setError('Персонаж не ответил. Попробуйте ещё раз.')
        setMessages((prev) => prev.filter((message) => message.id !== assistantMessageId))
      } else {
        lastAttemptRef.current = null
      }
    } catch (streamError) {
      console.error('Character chat error:', streamError)
      setError('Связь прервалась. Проверьте соединение и попробуйте ещё раз.')
      if (!received) {
        setMessages((prev) => prev.filter((message) => message.id !== assistantMessageId))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="mb-6 flex-1 space-y-4 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label={`Переписка с ${characterName}`}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {message.role === 'assistant' && <CharacterAvatar name={characterName} avatar={characterAvatar} />}

            <div
              className={`max-w-sm px-5 py-3 lg:max-w-md ${
                message.role === 'user'
                  ? 'rounded-3xl rounded-br-md bg-cf-air-accent text-white'
                  : 'cf-glass rounded-3xl rounded-bl-md text-cf-text-2'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
            </div>

            {message.role === 'user' && (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cf-air-surface-2 text-xs font-medium uppercase tracking-[0.1em] text-cf-text-3">
                Я
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <CharacterAvatar name={characterName} avatar={characterAvatar} />
            <div className="cf-glass rounded-3xl rounded-bl-md px-5 py-4">
              <div className="flex gap-2">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cf-live-on" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cf-live-on delay-100" />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cf-live-on delay-200" />
              </div>
            </div>
          </div>
        )}

        {!canGenerate && messages.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-cf-text-3">
            {statusMessage ?? `${characterName} сейчас не отвечает на сообщения.`}
          </p>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-cf-air-line bg-cf-air-surface px-4 py-3 text-sm text-cf-text-2"
        >
          {error}
        </div>
      ) : null}

      {/* Input Form */}
      {canGenerate ? (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Спроси ${characterName}...`}
            aria-label={`Сообщение для ${characterName}`}
            maxLength={CHARACTER_CHAT_CONFIG.maxQuestionChars}
            disabled={isLoading}
            className="h-12 flex-1 rounded-full border-cf-air-line bg-cf-air-surface px-5 text-cf-text-1 backdrop-blur-xl placeholder:text-cf-text-4"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-12 rounded-full bg-cf-air-accent px-6 font-medium text-white hover:bg-cf-air-accent-ink"
          >
            {isLoading ? 'Думает...' : 'Отправить'}
          </Button>
        </form>
      ) : (
        <p className="rounded-2xl border border-cf-air-line bg-cf-air-surface px-4 py-3 text-sm text-cf-text-3">
          {statusMessage ?? `${characterName} сейчас не отвечает на сообщения.`}
        </p>
      )}
    </div>
  )
}

function CharacterAvatar({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2">
      {avatar ? (
        <Image src={avatar} alt={name} fill sizes="40px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-medium uppercase text-cf-text-3">
          {name.slice(0, 1)}
        </div>
      )}
    </div>
  )
}
