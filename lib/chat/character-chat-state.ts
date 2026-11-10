import { z } from 'zod'
import type { CharacterTurnSnapshot } from '@/lib/ai/character-chat/turn-status'

export interface CharacterChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export type CharacterChatPhase = 'sending' | 'streaming' | 'confirming' | 'stopping' | 'completed' | 'failed' | 'cancelled' | 'unsaved'

export interface CharacterChatTurn {
  requestId: string
  text: string
  partialText: string
  phase: CharacterChatPhase
  stopRequested: boolean
  retried: boolean
  snapshot: CharacterTurnSnapshot | null
}

export interface CharacterChatUiError {
  message: string
  status?: number
  retryAt?: number
}

export interface CharacterChatState {
  messages: CharacterChatMessage[]
  input: string
  historyStatus: 'ready' | 'loading' | 'error'
  historyError: string | null
  turn: CharacterChatTurn | null
  error: CharacterChatUiError | null
  checking: boolean
}

const publicMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'character']),
  content: z.string(),
  created_at: z.string(),
})

const turnSchema = z.object({
  requestId: z.string().uuid(),
  attemptId: z.string().uuid().nullable(),
  status: z.enum(['not_found', 'pending', 'completed', 'failed', 'cancelled', 'unknown']),
  userMessage: publicMessageSchema.nullable(),
  assistantMessage: publicMessageSchema.nullable(),
  failureReason: z.enum(['empty_response', 'incomplete_response', 'rate_limited', 'timeout', 'save_failed', 'generation_failed']).nullable(),
  canRetry: z.boolean(),
  blocksNewTurn: z.boolean(),
  retryAt: z.string().nullable(),
})

export function parseCharacterTurn(value: unknown, requestId?: string): CharacterTurnSnapshot {
  const turn = turnSchema.parse(value)
  if ((requestId && turn.requestId !== requestId)
    || (turn.userMessage && turn.userMessage.role !== 'user')
    || (turn.assistantMessage && turn.assistantMessage.role !== 'character')
    || (turn.status === 'completed' && (!turn.userMessage || !turn.assistantMessage?.content.trim()))) {
    throw new Error('Некорректное подтверждение хода')
  }
  // Неподтверждённый ответ не может проникнуть в каноническую историю.
  return { ...turn, assistantMessage: turn.status === 'completed' ? turn.assistantMessage : null }
}

/** Дополнительная защита UI от system/неизвестных ролей даже при плохом GET. */
export function readCharacterMessages(value: unknown): CharacterChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return []
    const message = item as Record<string, unknown>
    if (typeof message.id !== 'string' || typeof message.content !== 'string') return []
    if (message.role !== 'user' && message.role !== 'character' && message.role !== 'assistant') return []
    return [{
      id: message.id,
      role: message.role === 'user' ? 'user' as const : 'assistant' as const,
      content: message.content,
      ...(typeof message.created_at === 'string' ? { created_at: message.created_at } : {}),
    }]
  })
}

/** Поздняя история добавляет записи по id, но никогда не стирает новые. */
export function mergeCharacterMessages(
  current: CharacterChatMessage[],
  incoming: CharacterChatMessage[],
): CharacterChatMessage[] {
  const merged = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) if (!merged.has(message.id)) merged.set(message.id, message)
  return [...merged.values()].sort((a, b) => {
    const left = a.created_at ? Date.parse(a.created_at) : 0
    const right = b.created_at ? Date.parse(b.created_at) : 0
    return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0)
  })
}

export function isCharacterTurnActive(turn: CharacterChatTurn | null): boolean {
  return Boolean(turn && ['sending', 'streaming', 'confirming', 'stopping'].includes(turn.phase))
}

export function canStartCharacterTurn(state: CharacterChatState): boolean {
  const retryAt = state.turn?.snapshot?.retryAt ? Date.parse(state.turn.snapshot.retryAt) : 0
  return state.historyStatus === 'ready' && !state.checking && !isCharacterTurnActive(state.turn)
    && state.error?.status !== 401 && state.error?.status !== 403
    && Math.max(state.error?.retryAt ?? 0, retryAt || 0) <= Date.now()
    && !(state.turn?.phase === 'unsaved' && (!state.turn.snapshot || state.turn.snapshot.blocksNewTurn))
}

export function canRetryCharacterTurn(turn: CharacterChatTurn | null): boolean {
  if (!turn?.text || isCharacterTurnActive(turn)) return false
  return Boolean(turn.snapshot?.canRetry || turn.snapshot?.status === 'not_found')
}

export function phaseForCharacterSnapshot(snapshot: CharacterTurnSnapshot): CharacterChatPhase {
  if (snapshot.status === 'completed' || snapshot.status === 'cancelled') return snapshot.status
  if (snapshot.status === 'failed') return snapshot.failureReason === 'save_failed' ? 'unsaved' : 'failed'
  return 'unsaved'
}

export function characterFailureMessage(snapshot: CharacterTurnSnapshot): string {
  switch (snapshot.failureReason) {
    case 'empty_response': return 'Сервер завершил ход без ответа. Ответ персонажа не сохранён.'
    case 'incomplete_response': return 'Ответ не был завершён. Показанный фрагмент не сохранён как ответ персонажа.'
    case 'rate_limited': return 'Лимит сообщений исчерпан. Повтор доступен после окончания паузы.'
    case 'timeout': return 'Сервер завершил ход по таймауту. Ответ персонажа не сохранён.'
    case 'save_failed': return 'Сервер не подтвердил запись ответа. Фрагмент оставлен только как черновик.'
    default: return 'Не удалось завершить ответ. Сообщение пользователя сохранено, ответ персонажа — нет.'
  }
}

export function characterLiveStatus(turn: CharacterChatTurn | null): string {
  if (!turn) return 'Можно начать разговор.'
  switch (turn.phase) {
    case 'sending': return turn.retried ? 'Повторная отправка хода…' : 'Отправляем сообщение…'
    case 'streaming': return 'Персонаж отвечает. Сохранение ещё не подтверждено.'
    case 'confirming': return 'Проверяем сохранение ответа на сервере…'
    case 'stopping': return 'Получение потока остановлено на устройстве. Проверяем статус серверной отмены…'
    case 'completed': return turn.stopRequested ? 'Отмена не успела завершиться: сервер уже сохранил ответ.' : 'Ответ сохранён на сервере.'
    case 'cancelled': return 'Сервер подтвердил отмену хода. Частичный ответ не сохранён.'
    case 'failed': return 'Ход завершился с ошибкой. Ответ персонажа не сохранён.'
    case 'unsaved': return turn.snapshot?.failureReason === 'save_failed'
      ? 'Ход завершился, но ответ не записан. Показанный фрагмент — только черновик.'
      : turn.stopRequested
      ? 'Получение потока остановлено на устройстве. Отмена и сохранение на сервере пока не подтверждены.'
      : 'Окончательный ответ не подтверждён. Сначала проверьте статус хода.'
  }
}

export function shouldStickToChatBottom(metrics: { scrollHeight: number; scrollTop: number; clientHeight: number }): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight < 80
}

export function shouldSendCharacterChatKey(event: {
  key: string
  shiftKey: boolean
  isComposing: boolean
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing
    && !event.ctrlKey && !event.altKey && !event.metaKey
}

export function retryAfterTimestamp(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return now + Number(value) * 1000
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(now, date) : undefined
}

export async function readCharacterChatError(response: Response): Promise<CharacterChatUiError> {
  let reason: unknown
  try {
    const payload: unknown = await response.json()
    if (payload && typeof payload === 'object') reason = (payload as Record<string, unknown>).reason
  } catch {
    // Прокси/сеть может отдать HTML вместо JSON. Внутренние детали не выводим.
  }
  let message = 'Не удалось получить ответ. Сначала проверим сохранённый статус хода.'
  switch (response.status) {
    case 401: message = 'Войдите, чтобы продолжить разговор.'; break
    case 403:
      message = reason === 'blocked' ? 'Общение с этим персонажем заблокировано. История остаётся доступной.'
        : reason === 'mode_unavailable' ? 'Автоматический ответ недоступен: персонаж отвечает вручную.'
          : 'Персонаж сейчас не принимает сообщения.'
      break
    case 409:
      message = reason === 'request_mismatch' ? 'Этот ход уже отправлен с другим текстом. Повтор заблокирован.'
        : reason === 'turn_status_unknown' ? 'Статус предыдущего хода неизвестен. Новый AI-вызов заблокирован.'
          : reason === 'retry_required' || reason === 'retry_stale' || reason === 'retry_not_allowed'
            ? 'Повтор не разрешён. Сначала проверьте актуальный статус хода.'
            : 'Предыдущий ответ ещё готовится, возможно в другой вкладке. Сначала проверим статус.'
      break
    case 429: message = 'Слишком много сообщений. Дождитесь окончания паузы перед повтором.'; break
    case 503:
      message = reason === 'canon_unavailable' ? 'Проверенный контекст персонажа недоступен. Попробуйте позже.'
        : reason === 'unconfigured' ? 'Автор ещё не настроил речь персонажа.' : 'AI-сервис временно недоступен.'
      break
    case 400: case 413: message = 'Сообщение не принято. Проверьте текст и его длину.'; break
    case 404: message = 'Персонаж или разговор не найден.'; break
  }
  return { message, status: response.status, retryAt: retryAfterTimestamp(response.headers.get('Retry-After')) }
}
