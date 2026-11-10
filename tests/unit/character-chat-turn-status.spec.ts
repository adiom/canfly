import { test, expect } from '@playwright/test'
import {
  characterAttemptMatches,
  decideCharacterTurnRetry,
  getCharacterAttempt,
  missingCharacterTurn,
  toCharacterTurnSnapshot,
} from '../../lib/ai/character-chat/turn-status'
import { characterChatRequestSchema, characterChatTurnQuerySchema } from '../../lib/schemas/character-chat'
import { ATTEMPT_ID, NEXT_ATTEMPT_ID, REQUEST_ID, storedAssistant, storedUser, turnSnapshot } from './fixtures/character-chat'

const NOW = Date.parse('2026-11-10T12:00:10.000Z')

test.describe('подтверждённый серверный статус хода', () => {
  test('completed требует связанного сохранённого ответа', () => {
    const snapshot = toCharacterTurnSnapshot({ userMessage: storedUser('completed'), assistantMessage: storedAssistant(), isLatest: true, now: NOW })
    expect(snapshot).toMatchObject({ status: 'completed', canRetry: false, assistantMessage: { content: 'Сохранённый ответ 🌿' } })
    expect(JSON.stringify(snapshot)).not.toContain('metadata')
    expect(JSON.stringify(snapshot)).not.toContain('usage')
  })

  test('completed без ответа и legacy-ответ без requestId — unknown, не replay', () => {
    for (const assistantMessage of [null, storedAssistant({ metadata: { source: 'model' } })]) {
      const snapshot = toCharacterTurnSnapshot({ userMessage: storedUser('completed'), assistantMessage, isLatest: true, now: NOW })
      expect(snapshot).toMatchObject({ status: 'unknown', assistantMessage: null, canRetry: false, blocksNewTurn: false })
    }
  })

  test('ответ из другого диалога, попытки или вопроса не подтверждает успех', () => {
    for (const assistantMessage of [
      storedAssistant({ conversation_id: 'other' }),
      storedAssistant({ metadata: { ...storedAssistant().metadata, attemptId: NEXT_ATTEMPT_ID } }),
      storedAssistant({ metadata: { ...storedAssistant().metadata, userMessageId: 'other-user-message' } }),
      storedAssistant({ content: '   ' }),
      storedAssistant({ role: 'system' }),
    ]) {
      expect(toCharacterTurnSnapshot({ userMessage: storedUser('completed'), assistantMessage, isLatest: true, now: NOW })?.status).toBe('unknown')
    }
  })

  test('pending не выдаёт дошедший текст как сохранённый ответ', () => {
    expect(toCharacterTurnSnapshot({ userMessage: storedUser(), assistantMessage: storedAssistant(), isLatest: true, now: NOW }))
      .toMatchObject({ status: 'pending', assistantMessage: null, canRetry: false, blocksNewTurn: true })
  })

  test('просроченный pending остаётся unknown, а не failed/cancelled', () => {
    expect(toCharacterTurnSnapshot({ userMessage: storedUser(), assistantMessage: null, isLatest: true, now: NOW + 120_000 }))
      .toMatchObject({ status: 'unknown', canRetry: false, blocksNewTurn: true })
  })

  test('deadline повторной попытки считается от нового startedAt, не даты вопроса', () => {
    const userMessage = storedUser('pending', {
      created_at: '2020-01-01T00:00:00.000Z',
      metadata: { requestId: REQUEST_ID, attempt: { id: NEXT_ATTEMPT_ID, status: 'pending', startedAt: '2026-11-10T12:00:08.000Z', expiresAt: '2026-11-10T12:03:08.000Z' } },
    })
    expect(toCharacterTurnSnapshot({ userMessage, assistantMessage: null, isLatest: true, now: NOW })?.status).toBe('pending')
  })

  test('сохранённый aborted подтверждает cancelled без реплики персонажа', () => {
    const userMessage = storedUser('failed', { metadata: { requestId: REQUEST_ID, attempt: { id: ATTEMPT_ID, status: 'failed', errorCode: 'aborted' } } })
    expect(toCharacterTurnSnapshot({ userMessage, assistantMessage: null, isLatest: true }))
      .toMatchObject({ status: 'cancelled', canRetry: true, assistantMessage: null })
  })

  test('timeout и сбой записи не маскируются отменой', () => {
    for (const errorCode of ['timeout', 'save_failed'] as const) {
      const userMessage = storedUser('failed', { metadata: { requestId: REQUEST_ID, attempt: { id: ATTEMPT_ID, status: 'failed', errorCode } } })
      expect(toCharacterTurnSnapshot({ userMessage, assistantMessage: null, isLatest: true }))
        .toMatchObject({ status: 'failed', failureReason: errorCode, canRetry: true })
    }
  })

  test('произвольная ошибка/закрытая metadata не выдаётся клиенту', () => {
    const userMessage = storedUser('failed', { metadata: { requestId: REQUEST_ID, passport: 'PRIVATE', attempt: { id: ATTEMPT_ID, status: 'failed', errorCode: 'PRIVATE_DATABASE_DETAIL' } } })
    const snapshot = toCharacterTurnSnapshot({ userMessage, assistantMessage: null, isLatest: true })
    expect(snapshot?.failureReason).toBe('generation_failed')
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE')
  })

  test('legacy failed без attemptId и старый вопрос после нового хода не повторяются', () => {
    expect(toCharacterTurnSnapshot({ userMessage: storedUser('failed', { metadata: { requestId: REQUEST_ID, attempt: { status: 'failed' } } }), assistantMessage: null, isLatest: true })?.canRetry).toBe(false)
    expect(toCharacterTurnSnapshot({ userMessage: storedUser('failed'), assistantMessage: null, isLatest: false })?.canRetry).toBe(false)
  })

  test('system и сообщение без requestId не становятся последним ходом', () => {
    expect(toCharacterTurnSnapshot({ userMessage: storedUser('pending', { role: 'system' }), assistantMessage: null, isLatest: true })).toBeNull()
    expect(toCharacterTurnSnapshot({ userMessage: storedUser('pending', { metadata: {} }), assistantMessage: null, isLatest: true })).toBeNull()
    expect(getCharacterAttempt({ attempt: [] })).toEqual({})
  })

  test('not_found — отсутствие записи, а не подтверждённая отмена', () => {
    expect(missingCharacterTurn(REQUEST_ID)).toMatchObject({ status: 'not_found', userMessage: null, assistantMessage: null, canRetry: false })
  })
})

test.describe('серверная проверка явного retry', () => {
  test('совпавший completed возвращает replay даже при старом retry token', () => {
    expect(decideCharacterTurnRetry({ snapshot: turnSnapshot('completed'), content: 'Привет, Соня', retryAttemptId: NEXT_ATTEMPT_ID }))
      .toEqual({ kind: 'replay', text: 'Сохранённый ответ 🌿' })
  })

  test('request mismatch проверяется до replay успешного ответа', () => {
    expect(decideCharacterTurnRetry({ snapshot: turnSnapshot('completed'), content: 'Другой вопрос' }))
      .toEqual({ kind: 'conflict', reason: 'request_mismatch' })
  })

  test('pending/unknown никогда не разрешают новый платный повтор', () => {
    for (const status of ['pending', 'unknown'] as const) {
      expect(decideCharacterTurnRetry({ snapshot: turnSnapshot(status), content: 'Привет, Соня', retryAttemptId: ATTEMPT_ID })).toMatchObject({ kind: 'busy' })
    }
  })

  test('без явного token повтор подтверждённого failed запрещён', () => {
    expect(decideCharacterTurnRetry({ snapshot: turnSnapshot('failed'), content: 'Привет, Соня' }))
      .toEqual({ kind: 'conflict', reason: 'retry_required' })
  })

  test('устаревший token отвергается; актуальный разрешает failed/cancelled', () => {
    expect(decideCharacterTurnRetry({ snapshot: turnSnapshot('failed'), content: 'Привет, Соня', retryAttemptId: NEXT_ATTEMPT_ID }))
      .toEqual({ kind: 'conflict', reason: 'retry_stale' })
    for (const status of ['failed', 'cancelled'] as const) {
      expect(decideCharacterTurnRetry({ snapshot: turnSnapshot(status), content: 'Привет, Соня', retryAttemptId: ATTEMPT_ID })).toEqual({ kind: 'retry' })
    }
  })

  test('повтор старого неуспешного хода не вставляется в уже продолженный разговор', () => {
    expect(decideCharacterTurnRetry({ snapshot: turnSnapshot('failed', { canRetry: false }), content: 'Привет, Соня', retryAttemptId: ATTEMPT_ID }))
      .toEqual({ kind: 'conflict', reason: 'retry_not_allowed' })
  })

  test('fencing не даёт старой генерации завершить/испортить новую попытку', () => {
    const metadata = { requestId: REQUEST_ID, attempt: { id: NEXT_ATTEMPT_ID, status: 'pending' } }
    expect(characterAttemptMatches(metadata, REQUEST_ID, ATTEMPT_ID)).toBe(false)
    expect(characterAttemptMatches(metadata, REQUEST_ID, NEXT_ATTEMPT_ID)).toBe(true)
    expect(characterAttemptMatches({ ...metadata, attempt: { id: NEXT_ATTEMPT_ID, status: 'completed' } }, REQUEST_ID, NEXT_ATTEMPT_ID)).toBe(false)
    expect(characterAttemptMatches(metadata, null, NEXT_ATTEMPT_ID)).toBe(false)
  })

  test('пауза rate limit проверяется до разрешения повтора', () => {
    expect(decideCharacterTurnRetry({ snapshot: turnSnapshot('failed', { retryAt: new Date(Date.now() + 60_000).toISOString() }), content: 'Привет, Соня', retryAttemptId: ATTEMPT_ID })).toMatchObject({ kind: 'busy' })
  })
})

test.describe('requestId / retryAttemptId HTTP-схемы', () => {
  test('точная GET-сверка требует UUID', () => {
    expect(characterChatTurnQuerySchema.safeParse({ requestId: REQUEST_ID }).success).toBe(true)
    for (const requestId of ['', 'bad-id', 42]) expect(characterChatTurnQuerySchema.safeParse({ requestId }).success).toBe(false)
  })

  test('retry token без requestId или не UUID отклоняется', () => {
    const base = { characterSlug: 'sonya', message: 'Привет' }
    expect(characterChatRequestSchema.safeParse({ ...base, retryAttemptId: ATTEMPT_ID }).success).toBe(false)
    expect(characterChatRequestSchema.safeParse({ ...base, requestId: REQUEST_ID, retryAttemptId: 'bad' }).success).toBe(false)
    expect(characterChatRequestSchema.safeParse({ ...base, requestId: REQUEST_ID, retryAttemptId: ATTEMPT_ID }).success).toBe(true)
  })
})
