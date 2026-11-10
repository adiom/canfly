import type { CharacterMessage } from '@/lib/types'
import type { PublicConversationMessage } from '@/lib/character-public'
import { CHARACTER_CHAT_CONFIG } from './config'

export type CharacterTurnStatus = 'not_found' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'unknown'
export type CharacterTurnFailure = 'empty_response' | 'incomplete_response' | 'rate_limited' | 'timeout' | 'save_failed' | 'generation_failed'

/** Публичный результат хода, не произвольная metadata модели/канона. */
export interface CharacterTurnSnapshot {
  requestId: string
  attemptId: string | null
  status: CharacterTurnStatus
  userMessage: PublicConversationMessage | null
  assistantMessage: PublicConversationMessage | null
  failureReason: CharacterTurnFailure | null
  canRetry: boolean
  blocksNewTurn: boolean
  retryAt: string | null
}

export function getCharacterAttempt(metadata: CharacterMessage['metadata']): Record<string, unknown> {
  const attempt = metadata?.attempt
  return attempt && typeof attempt === 'object' && !Array.isArray(attempt)
    ? attempt as Record<string, unknown>
    : {}
}

export function isChatRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
}

/** Fencing старой генерации при повторе того же логического requestId. */
export function characterAttemptMatches(
  metadata: CharacterMessage['metadata'],
  requestId: string | null,
  attemptId: string,
): boolean {
  return (requestId === null ? !metadata?.requestId : metadata?.requestId === requestId)
    && getCharacterAttempt(metadata).id === attemptId
    && getCharacterAttempt(metadata).status === 'pending'
}

export function missingCharacterTurn(requestId: string): CharacterTurnSnapshot {
  return {
    requestId,
    attemptId: null,
    status: 'not_found',
    userMessage: null,
    assistantMessage: null,
    failureReason: null,
    canRetry: false,
    blocksNewTurn: false,
    retryAt: null,
  }
}

function publicMessage(message: CharacterMessage): PublicConversationMessage | null {
  if (message.role !== 'user' && message.role !== 'character') return null
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    created_at: message.created_at,
  }
}

function failureReason(code: unknown): CharacterTurnFailure {
  switch (code) {
    case 'empty_response':
    case 'incomplete_response':
    case 'rate_limited':
    case 'timeout':
    case 'save_failed':
      return code
    default:
      return 'generation_failed'
  }
}

/**
 * `completed` подтверждается связанной записью ответа, а не EOF/временем/ролью
 * соседнего сообщения. Legacy-ответы без связи читаются в истории как раньше,
 * но не служат доказательством результата конкретного requestId.
 */
export function toCharacterTurnSnapshot(input: {
  userMessage: CharacterMessage
  assistantMessage: CharacterMessage | null
  isLatest: boolean
  now?: number
}): CharacterTurnSnapshot | null {
  const { userMessage, assistantMessage, isLatest, now = Date.now() } = input
  const requestId = userMessage.metadata?.requestId
  if (userMessage.role !== 'user' || !isChatRequestId(requestId)) return null

  const attempt = getCharacterAttempt(userMessage.metadata)
  const attemptId = isChatRequestId(attempt.id) ? attempt.id : null
  const linkedReply = assistantMessage?.role === 'character'
    && assistantMessage.conversation_id === userMessage.conversation_id
    && assistantMessage.metadata?.requestId === requestId
    && assistantMessage.metadata?.userMessageId === userMessage.id
    && assistantMessage.metadata?.attemptId === attemptId
    && attemptId !== null
    && assistantMessage.content.trim().length > 0
      ? assistantMessage
      : null

  let status: CharacterTurnStatus = 'unknown'
  if (attempt.status === 'completed' && linkedReply) status = 'completed'
  if (attempt.status === 'failed') status = attempt.errorCode === 'aborted' ? 'cancelled' : 'failed'
  if (attempt.status === 'pending') {
    const startedAt = typeof attempt.startedAt === 'string'
      ? Date.parse(attempt.startedAt)
      : Date.parse(userMessage.created_at)
    const expiresAt = typeof attempt.expiresAt === 'string'
      ? Date.parse(attempt.expiresAt)
      : startedAt + CHARACTER_CHAT_CONFIG.activeTurnTtlSeconds * 1000
    // Истёкший deadline не доказывает ни отмену, ни отсутствие оплаты.
    if (Number.isFinite(expiresAt) && expiresAt > now) status = 'pending'
  }

  return {
    requestId,
    attemptId,
    status,
    userMessage: publicMessage(userMessage),
    assistantMessage: status === 'completed' && linkedReply ? publicMessage(linkedReply) : null,
    failureReason: status === 'failed' ? failureReason(attempt.errorCode) : null,
    canRetry: isLatest && attemptId !== null && (status === 'failed' || status === 'cancelled'),
    // Старый completed без связи не разрешает regenerate, но не запрещает
    // начать новый разговорный ход с другим вопросом.
    blocksNewTurn: attempt.status !== 'completed' && attempt.status !== 'failed',
    retryAt: typeof attempt.retryAt === 'string' && Number.isFinite(Date.parse(attempt.retryAt))
      ? attempt.retryAt
      : null,
  }
}

export type CharacterRetryDecision =
  | { kind: 'replay'; text: string }
  | { kind: 'retry' }
  | { kind: 'busy'; reason: 'turn_in_progress' | 'turn_status_unknown' }
  | { kind: 'conflict'; reason: 'request_mismatch' | 'retry_required' | 'retry_not_allowed' | 'retry_stale' }

/** Проверка на сервере повторяется под блокировкой, несмотря на GET клиента. */
export function decideCharacterTurnRetry(input: {
  snapshot: CharacterTurnSnapshot
  content: string
  retryAttemptId?: string
}): CharacterRetryDecision {
  const { snapshot, content, retryAttemptId } = input
  if (snapshot.userMessage?.content !== content) {
    return { kind: 'conflict', reason: 'request_mismatch' }
  }
  if (snapshot.status === 'completed' && snapshot.assistantMessage) {
    return { kind: 'replay', text: snapshot.assistantMessage.content }
  }
  if (snapshot.status === 'pending' || snapshot.status === 'unknown') {
    return { kind: 'busy', reason: snapshot.status === 'pending' ? 'turn_in_progress' : 'turn_status_unknown' }
  }
  if (!snapshot.canRetry) return { kind: 'conflict', reason: 'retry_not_allowed' }
  if (!retryAttemptId) return { kind: 'conflict', reason: 'retry_required' }
  if (retryAttemptId !== snapshot.attemptId) return { kind: 'conflict', reason: 'retry_stale' }
  if (snapshot.retryAt && Date.parse(snapshot.retryAt) > Date.now()) {
    return { kind: 'busy', reason: 'turn_in_progress' }
  }
  return { kind: 'retry' }
}
