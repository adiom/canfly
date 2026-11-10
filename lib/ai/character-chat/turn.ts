import type { ModelMessage } from 'ai'

import type { CharacterMessage } from '@/lib/types'

/**
 * Текст сообщения хранится как обычный текст. Убираем только то, что нельзя
 * записать в Postgres (NUL), и лишние пробелы по краям.
 */
export function normalizeChatText(value: string): string {
  return value.replace(/\u0000/g, '').trim()
}

/**
 * Устаревший клиент присылал весь массив сообщений. Доверять истории нельзя,
 * поэтому берём из него ровно одну последнюю непустую реплику пользователя.
 * Объекты без строкового `content` и все прочие роли игнорируются.
 */
export function extractLatestUserMessage(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index]
    if (!candidate || typeof candidate !== 'object') continue

    const { role, content } = candidate as { role?: unknown; content?: unknown }
    if (role !== 'user' || typeof content !== 'string') continue

    const text = normalizeChatText(content)
    if (text) return text
  }

  return null
}

/**
 * Отбирает историю с конца, пока суммарная длина текста не превысит бюджет.
 * Самая свежая реплика (только что записанный вопрос) остаётся всегда.
 * Это ограничение по символам, а не точный подсчёт токенов.
 */
export function buildModelContext(
  messages: Array<Pick<CharacterMessage, 'role' | 'content'>>,
  maxChars: number,
): ModelMessage[] {
  const normalized: ModelMessage[] = messages
    .filter((message) => message.role === 'user' || message.role === 'character')
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role === 'character' ? 'assistant' : message.role,
      content: message.content,
    }))

  const selected: ModelMessage[] = []
  let total = 0

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const message = normalized[index]
    const length = message.content.length
    if (selected.length > 0 && total + length > maxChars) break
    selected.push(message)
    total += length
  }

  return selected.reverse()
}
