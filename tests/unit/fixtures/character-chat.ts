import type { CharacterMessage } from '../../../lib/types'
import type { CharacterTurnSnapshot } from '../../../lib/ai/character-chat/turn-status'

export const REQUEST_ID = '11111111-1111-4111-8111-111111111111'
export const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222'
export const NEXT_ATTEMPT_ID = '33333333-3333-4333-8333-333333333333'
export const USER_MESSAGE_ID = '44444444-4444-4444-8444-444444444444'
export const ASSISTANT_MESSAGE_ID = '55555555-5555-4555-8555-555555555555'

export function storedUser(status = 'pending', overrides: Partial<CharacterMessage> = {}): CharacterMessage {
  return {
    id: USER_MESSAGE_ID,
    conversation_id: 'conversation',
    role: 'user',
    content: 'Привет, Соня',
    created_at: '2026-11-10T12:00:00.000Z',
    metadata: {
      requestId: REQUEST_ID,
      attempt: { id: ATTEMPT_ID, status, startedAt: '2026-11-10T12:00:00.000Z' },
    },
    ...overrides,
  }
}

export function storedAssistant(overrides: Partial<CharacterMessage> = {}): CharacterMessage {
  return {
    id: ASSISTANT_MESSAGE_ID,
    conversation_id: 'conversation',
    role: 'character',
    content: 'Сохранённый ответ 🌿',
    created_at: '2026-11-10T12:00:05.000Z',
    metadata: { requestId: REQUEST_ID, userMessageId: USER_MESSAGE_ID, attemptId: ATTEMPT_ID, usage: { totalTokens: 1 } },
    ...overrides,
  }
}

export function turnSnapshot(status: CharacterTurnSnapshot['status'], overrides: Partial<CharacterTurnSnapshot> = {}): CharacterTurnSnapshot {
  const user = storedUser()
  const assistant = storedAssistant()
  return {
    requestId: REQUEST_ID,
    attemptId: ATTEMPT_ID,
    status,
    userMessage: status === 'not_found' ? null : { id: user.id, role: 'user', content: user.content, created_at: user.created_at },
    assistantMessage: status === 'completed' ? { id: assistant.id, role: 'character', content: assistant.content, created_at: assistant.created_at } : null,
    canRetry: status === 'failed' || status === 'cancelled',
    blocksNewTurn: status === 'pending' || status === 'unknown',
    failureReason: status === 'failed' ? 'generation_failed' : null,
    retryAt: null,
    ...overrides,
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}
