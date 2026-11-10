import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

import { loadTestCredentials } from './setup/credentials'
import { loginViaMagicLink } from './setup/login-helper'
import { loadEnvLocal, pgConfig } from './setup/pg'

/**
 * Проверки HTTP/БД-контракта чата. По умолчанию выключены: они пишут в
 * `character_friendships` / `character_conversations` и требуют изолированной
 * БД. Включать только так:
 *
 *   CANFLY_CHAT_E2E=1 pnpm exec playwright test e2e/character-chat.spec.ts
 *
 * Модель здесь не вызывается: все проверки упираются в валидацию, доступность
 * или блокировку хода до `streamText`.
 */
const ENABLED = process.env.CANFLY_CHAT_E2E === '1'
const CREDENTIALS = loadTestCredentials()

interface ChatCharacter {
  id: string
  slug: string
}

const REQUEST_ID = randomUUID()
const ATTEMPT_ID = randomUUID()

async function pickCharacter(client: Client, userId: string): Promise<ChatCharacter> {
  const { rows } = await client.query<ChatCharacter>(
    `SELECT c.id, c.slug
     FROM characters c
     WHERE c.character_type = 'person'
       AND c.reply_mode = 'ai_auto'
       AND c.can_receive_messages = TRUE
       AND COALESCE(trim(c.system_role), '') <> ''
       AND NOT EXISTS (
         SELECT 1 FROM character_conversations cc
         WHERE cc.user_id = $1 AND cc.character_id = c.id
       )
     ORDER BY c.created_at ASC
     LIMIT 1`,
    [userId],
  )

  const character = rows[0]
  if (!character) {
    throw new Error('Нет готового персонажа без диалога у тестового пользователя')
  }
  return character
}

async function postChat(page: Page, body: Record<string, unknown>) {
  return page.request.post('/api/characters/chat', { data: body })
}

test.describe('character chat: HTTP-контракт и блокировки', () => {
  test.skip(
    !ENABLED,
    'DB-мутирующие проверки: включите CANFLY_CHAT_E2E=1 на изолированной БД',
  )
  test.skip(!CREDENTIALS, 'Тестовый администратор не создан — globalSetup не выполнялся')

  test.describe.configure({ mode: 'serial' })

  let client: Client
  let character: ChatCharacter

  test.beforeAll(async () => {
    loadEnvLocal()
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL не настроен')

    client = new Client(pgConfig(url))
    await client.connect()
    character = await pickCharacter(client, CREDENTIALS!.userId)
  })

  test.afterAll(async () => {
    await client?.end()
  })

  test.beforeEach(async ({ page }) => {
    await loginViaMagicLink(page, CREDENTIALS!.email)
  })

  test('публичный API не отдаёт закрытые поля персонажа', async ({ page }) => {
    const response = await page.request.get('/api/characters')
    expect(response.ok()).toBeTruthy()

    const list = (await response.json()) as Array<Record<string, unknown>>
    expect(list.length).toBeGreaterThan(0)

    for (const item of list) {
      expect(item).not.toHaveProperty('system_role')
      expect(item).not.toHaveProperty('passport')
      expect(item).not.toHaveProperty('map_image_url')
      expect(item).toHaveProperty('abilities')
    }
  })

  test('GET истории не создаёт разговор и не меняет updated_at', async ({ page }) => {
    const before = await client.query<{ count: number; updated: string | null }>(
      `SELECT COUNT(*)::int AS count, MAX(updated_at)::text AS updated
       FROM character_conversations
       WHERE user_id = $1`,
      [CREDENTIALS!.userId],
    )

    for (let index = 0; index < 2; index += 1) {
      const response = await page.request.get(`/api/characters/${character.slug}/conversation`)
      expect(response.ok()).toBeTruthy()
      const payload = await response.json()
      expect(payload.data.conversation).toBeNull()
      expect(payload.data.messages).toEqual([])
      expect(payload.data.lastTurn).toBeNull()
    }

    const after = await client.query<{ count: number; updated: string | null }>(
      `SELECT COUNT(*)::int AS count, MAX(updated_at)::text AS updated
       FROM character_conversations
       WHERE user_id = $1`,
      [CREDENTIALS!.userId],
    )

    expect(after.rows[0]?.count).toBe(before.rows[0]?.count)
    expect(after.rows[0]?.updated).toBe(before.rows[0]?.updated)
  })

  test('GET requestId валидирует UUID и не создаёт отсутствующий ход', async ({ page }) => {
    const invalid = await page.request.get(`/api/characters/${character.slug}/conversation?requestId=bad-id`)
    expect(invalid.status()).toBe(400)
    const response = await page.request.get(`/api/characters/${character.slug}/conversation?requestId=${REQUEST_ID}`)
    expect(response.ok()).toBeTruthy()
    expect(response.headers()['cache-control']).toContain('no-store')
    expect((await response.json()).data.turn).toMatchObject({ requestId: REQUEST_ID, status: 'not_found', userMessage: null, assistantMessage: null })
    const conversation = await client.query('SELECT id FROM character_conversations WHERE user_id = $1 AND character_id = $2', [CREDENTIALS!.userId, character.id])
    expect(conversation.rows).toHaveLength(0)
  })

  test('пустой запрос отклоняется до хода', async ({ page }) => {
    const response = await postChat(page, { characterSlug: character.slug, message: '   ' })
    expect(response.status()).toBe(400)
  })

  test('гость открывает disabled/manual/hybrid/unconfigured без чтения user.id и истории', async ({ page }) => {
    await page.context().clearCookies()
    const created: string[] = []
    try {
      for (const mode of ['disabled', 'manual', 'hybrid', 'ai_auto']) {
        const slug = `guest-chat-regression-${randomUUID()}`
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO characters (name, slug, reply_mode, can_receive_messages, system_role, character_type)
           VALUES ('Тест интерфейса', $1, $2, TRUE, $3, 'person') RETURNING id`,
          [slug, mode, mode === 'ai_auto' ? '' : 'Технический mock, не авторский канон'],
        )
        created.push(inserted.rows[0]!.id)
        const response = await page.goto(`/characters/${slug}/chat`)
        expect(response?.status()).toBe(200)
        await expect(page.getByRole('link', { name: 'Войти в canfly' })).toBeVisible()
        await expect(page.getByRole('textbox')).toHaveCount(0)
      }
    } finally {
      for (const id of created) await client.query('DELETE FROM characters WHERE id = $1', [id])
    }
  })

  test('повтор requestId и второй таб получают 409 без вызова модели', async ({ page }) => {
    const conversation = await client.query<{ id: string }>(
      `INSERT INTO character_conversations (user_id, character_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, character_id) DO UPDATE SET title = character_conversations.title
       RETURNING id`,
      [CREDENTIALS!.userId, character.id],
    )
    const conversationId = conversation.rows[0]!.id

    try {
      await client.query(
        `INSERT INTO character_messages (conversation_id, role, content, metadata)
         VALUES ($1, 'user', $2, $3::jsonb)`,
        [
          conversationId,
          'исходный вопрос',
          JSON.stringify({
            requestId: REQUEST_ID,
            attempt: { id: ATTEMPT_ID, status: 'pending', startedAt: new Date().toISOString() },
          }),
        ],
      )

      // Тот же requestId с другим текстом — конфликт, а не новый вопрос.
      const mismatch = await postChat(page, {
        characterSlug: character.slug,
        message: 'другой текст',
        requestId: REQUEST_ID,
      })
      expect(mismatch.status()).toBe(409)
      expect((await mismatch.json()).reason).toBe('request_mismatch')

      // Тот же requestId и текст, пока ход активен, — «уже готовится».
      const repeated = await postChat(page, {
        characterSlug: character.slug,
        message: 'исходный вопрос',
        requestId: REQUEST_ID,
      })
      expect(repeated.status()).toBe(409)
      expect((await repeated.json()).reason).toBe('turn_in_progress')

      // Другой requestId при активном ходе — тоже 409 (второй таб).
      const secondTab = await postChat(page, {
        characterSlug: character.slug,
        message: 'вопрос из второго таба',
        requestId: '22222222-2222-4222-8222-222222222222',
      })
      expect(secondTab.status()).toBe(409)
      expect((await secondTab.json()).reason).toBe('turn_in_progress')

      const status = await page.request.get(`/api/characters/${character.slug}/conversation?requestId=${REQUEST_ID}`)
      const snapshot = (await status.json()).data.turn
      expect(snapshot).toMatchObject({ requestId: REQUEST_ID, attemptId: ATTEMPT_ID, status: 'pending', canRetry: false, assistantMessage: null })
      expect(JSON.stringify(snapshot)).not.toContain('metadata')
    } finally {
      await client.query(
        'DELETE FROM character_conversations WHERE user_id = $1 AND character_id = $2',
        [CREDENTIALS!.userId, character.id],
      )
    }
  })

  test('completed подтверждается canonical id; replay не создаёт новый ответ', async ({ page }) => {
    const conversation = await client.query<{ id: string }>(
      'INSERT INTO character_conversations (user_id, character_id) VALUES ($1, $2) RETURNING id',
      [CREDENTIALS!.userId, character.id],
    )
    const conversationId = conversation.rows[0]!.id
    try {
      const question = await client.query<{ id: string }>(
        `INSERT INTO character_messages (conversation_id, role, content, metadata)
         VALUES ($1, 'user', 'вопрос', $2::jsonb) RETURNING id`,
        [conversationId, JSON.stringify({ requestId: REQUEST_ID, attempt: { id: ATTEMPT_ID, status: 'completed' } })],
      )
      const answer = await client.query<{ id: string }>(
        `INSERT INTO character_messages (conversation_id, role, content, metadata)
         VALUES ($1, 'character', 'сохранённый ответ 🌿', $2::jsonb) RETURNING id`,
        [conversationId, JSON.stringify({ requestId: REQUEST_ID, attemptId: ATTEMPT_ID, userMessageId: question.rows[0]!.id, privateDiagnostic: 'PRIVATE' })],
      )
      const response = await page.request.get(`/api/characters/${character.slug}/conversation?requestId=${REQUEST_ID}`)
      expect(response.ok()).toBeTruthy()
      const snapshot = (await response.json()).data.turn
      expect(snapshot).toMatchObject({ status: 'completed', canRetry: false, assistantMessage: { id: answer.rows[0]!.id, content: 'сохранённый ответ 🌿' } })
      expect(JSON.stringify(snapshot)).not.toContain('PRIVATE')
      const replay = await postChat(page, { characterSlug: character.slug, message: 'вопрос', requestId: REQUEST_ID })
      expect(replay.status()).toBe(200)
      expect(await replay.text()).toBe('сохранённый ответ 🌿')
      const mismatch = await postChat(page, { characterSlug: character.slug, message: 'другой вопрос', requestId: REQUEST_ID })
      expect(mismatch.status()).toBe(409)
      expect((await mismatch.json()).reason).toBe('request_mismatch')
      const count = await client.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM character_messages WHERE conversation_id = $1', [conversationId])
      expect(count.rows[0]?.count).toBe(2)
    } finally {
      await client.query('DELETE FROM character_conversations WHERE id = $1', [conversationId])
    }
  })

  test('failed требует явный retry token; expired pending не разрешает платный повтор', async ({ page }) => {
    const conversation = await client.query<{ id: string }>(
      'INSERT INTO character_conversations (user_id, character_id) VALUES ($1, $2) RETURNING id',
      [CREDENTIALS!.userId, character.id],
    )
    const conversationId = conversation.rows[0]!.id
    try {
      await client.query(
        `INSERT INTO character_messages (conversation_id, role, content, metadata)
         VALUES ($1, 'user', 'вопрос', $2::jsonb)`,
        [conversationId, JSON.stringify({ requestId: REQUEST_ID, attempt: { id: ATTEMPT_ID, status: 'failed', errorCode: 'aborted' } })],
      )
      const status = await page.request.get(`/api/characters/${character.slug}/conversation?requestId=${REQUEST_ID}`)
      expect((await status.json()).data.turn).toMatchObject({ status: 'cancelled', canRetry: true, assistantMessage: null })
      const implicit = await postChat(page, { characterSlug: character.slug, message: 'вопрос', requestId: REQUEST_ID })
      expect(implicit.status()).toBe(409)
      expect((await implicit.json()).reason).toBe('retry_required')
      await client.query(
        `UPDATE character_messages SET metadata = $2::jsonb WHERE conversation_id = $1`,
        [conversationId, JSON.stringify({ requestId: REQUEST_ID, attempt: { id: ATTEMPT_ID, status: 'pending', expiresAt: '2000-01-01T00:00:00Z' } })],
      )
      const expired = await page.request.get(`/api/characters/${character.slug}/conversation?requestId=${REQUEST_ID}`)
      expect((await expired.json()).data.turn).toMatchObject({ status: 'unknown', canRetry: false })
      const retry = await postChat(page, { characterSlug: character.slug, message: 'вопрос', requestId: REQUEST_ID, retryAttemptId: ATTEMPT_ID })
      expect(retry.status()).toBe(409)
      expect((await retry.json()).reason).toBe('turn_status_unknown')
      const count = await client.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM character_messages WHERE conversation_id = $1', [conversationId])
      expect(count.rows[0]?.count).toBe(1)
    } finally {
      await client.query('DELETE FROM character_conversations WHERE id = $1', [conversationId])
    }
  })

  test('blocked: DELETE не снимает блокировку, POST не делает другом, чат закрыт', async ({ page }) => {
    await client.query(
      `INSERT INTO character_friendships (user_id, character_id, status)
       VALUES ($1, $2, 'blocked')
       ON CONFLICT (user_id, character_id)
       DO UPDATE SET status = 'blocked'`,
      [CREDENTIALS!.userId, character.id],
    )

    try {
      const removed = await page.request.delete(`/api/characters/${character.slug}/friendship`)
      expect(removed.status()).toBe(409)
      expect((await removed.json()).reason).toBe('blocked')

      const added = await page.request.post(`/api/characters/${character.slug}/friendship`)
      expect(added.status()).toBe(201)
      const addedPayload = await added.json()
      expect(addedPayload.data.friendship.status).toBe('blocked')

      const chat = await postChat(page, {
        characterSlug: character.slug,
        message: 'можно поговорить?',
      })
      expect(chat.status()).toBe(403)
      expect((await chat.json()).reason).toBe('blocked')
    } finally {
      await client.query(
        'DELETE FROM character_friendships WHERE user_id = $1 AND character_id = $2',
        [CREDENTIALS!.userId, character.id],
      )
    }
  })
})
