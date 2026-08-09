'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import { useRef, useEffect, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CharacterChatProps {
  characterSlug: string
  characterName: string
  characterAvatar: string
}

export function CharacterChat({ characterSlug, characterName, characterAvatar }: CharacterChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Привет! Я ${characterName}. Рад(а) познакомиться с тобой. Хочешь узнать больше о мне, о нашей вселенной или просто поговорить?`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/characters/${characterSlug}/conversation`)
        const payload = await response.json()
        const savedMessages = payload.data?.messages

        if (!active || !Array.isArray(savedMessages) || savedMessages.length === 0) {
          return
        }

        setMessages(
          savedMessages.map(
            (message: { id: string; role: 'user' | 'character' | 'system'; content: string }) => ({
              id: message.id,
              role: message.role === 'character' ? 'assistant' : 'user',
              content: message.content,
            }),
          ),
        )
      } catch (error) {
        console.error('Conversation history error:', error)
      } finally {
        if (active) setHistoryLoading(false)
      }
    }

    loadHistory()

    return () => {
      active = false
    }
  }, [characterSlug])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/characters/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })).concat([{ role: 'user', content: input }]),
          characterSlug,
        }),
      })

      if (!response.ok) throw new Error('Chat failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let assistantMessage = ''
      const messageId = Date.now().toString()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        assistantMessage += chunk

        setMessages((prev) => {
          const existing = prev.find((m) => m.id === messageId)
          if (existing) {
            return prev.map((m) => (m.id === messageId ? { ...m, content: assistantMessage } : m))
          }
          return [
            ...prev,
            {
              id: messageId,
              role: 'assistant',
              content: assistantMessage,
            },
          ]
        })
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Извини, произошла ошибка. Попробуй ещё раз.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages Container */}
      <div className="mb-6 flex-1 space-y-4 overflow-y-auto">
        {historyLoading && (
          <div className="cf-glass rounded-2xl px-4 py-3 text-sm text-cf-text-3">
            Загружаем историю диалога...
          </div>
        )}

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
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Спроси ${characterName}...`}
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
