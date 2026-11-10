import { randomBytes, pbkdf2 } from 'crypto'
import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import {
  AdminUserProfile,
  CharacterConversation,
  CharacterFriendship,
  CharacterMessage,
  PublicRole,
  SystemRole,
  UserProfile,
} from '@/lib/types'
import { fetchUserHighlights } from './chapter-highlights'
function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, 120000, 32, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(`pbkdf2$120000$${salt.toString('base64url')}$${key.toString('base64url')}`)
    })
  })
}

export function normalizeLogin(value: unknown) {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, '')
    : ''
}

export async function findUserByLogin(login: string) {
  return dbQueryOne<UserProfile & { password_hash: string | null }>(
    'SELECT * FROM users WHERE login = $1 AND COALESCE(is_deleted, FALSE) = FALSE LIMIT 1',
    [login],
  )
}

export async function createPasswordUser(data: {
  login: string
  password: string
  displayName?: string
  publicRole?: PublicRole
  isAdmin?: boolean
  roles?: SystemRole[]
}) {
  const handle = data.login
  const passwordHash = await hashPassword(data.password)
  const user = await dbQueryOne<UserProfile>(
    `
      INSERT INTO users (login, password_hash, handle, display_name, public_role, is_admin)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.login,
      passwordHash,
      handle,
      data.displayName || data.login,
      data.publicRole ?? 'reader',
      data.isAdmin ?? false,
    ],
  )

  if (!user) {
    throw new Error('Failed to create user')
  }

  if (data.roles?.length) {
    await setSystemRoles(user.id, data.roles)
  }

  return user
}

export async function setSystemRoles(userId: string, roles: SystemRole[]) {
  const normalizedRoles = Array.from(new Set(roles)).filter(
    (role): role is SystemRole => role === 'editor',
  )

  await dbQuery('DELETE FROM user_roles WHERE user_id = $1', [userId])

  if (normalizedRoles.length === 0) {
    return
  }

  await dbQuery(
    `
      INSERT INTO user_roles (user_id, role)
      SELECT $1::uuid, unnest($2::user_role[])
      ON CONFLICT DO NOTHING
    `,
    [userId, normalizedRoles],
  )
}

export async function setPublicRole(userId: string, publicRole: PublicRole) {
  return dbQueryOne<UserProfile>(
    'UPDATE users SET public_role = $2 WHERE id = $1 RETURNING *',
    [userId, publicRole],
  )
}

export async function setAdminStatus(userId: string, isAdmin: boolean) {
  return dbQueryOne<UserProfile>(
    'UPDATE users SET is_admin = $2 WHERE id = $1 RETURNING *',
    [userId, isAdmin],
  )
}

export async function updateUserPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password)
  return dbQueryOne<UserProfile>(
    `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1
      RETURNING *
    `,
    [userId, passwordHash],
  )
}

export async function listAdminUsers() {
  return dbQuery<AdminUserProfile>(
    `
      SELECT
        u.id,
        u.email,
        u.login,
        u.handle,
        u.display_name,
        u.avatar,
        u.bio,
        u.public_role,
        u.is_admin,
        u.is_deleted,
        u.deleted_at,
        u.created_at,
        u.updated_at,
        COALESCE(
          array_agg(ur.role::text ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
          ARRAY[]::text[]
        ) AS system_roles,
        COUNT(DISTINCT cf.id)::int AS friends_count,
        COUNT(DISTINCT cc.id)::int AS conversations_count
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN character_friendships cf ON cf.user_id = u.id
      LEFT JOIN character_conversations cc ON cc.user_id = u.id
      WHERE COALESCE(u.is_deleted, FALSE) = FALSE
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `,
  )
}

export async function softDeleteUser(userId: string) {
  return dbQueryOne<UserProfile>(
    `
      UPDATE users
      SET is_deleted = TRUE,
          deleted_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId],
  )
}

export async function countActiveAdmins(excludeUserId?: string) {
  const params: unknown[] = []
  let where = `COALESCE(is_admin, FALSE) = TRUE`
  if (excludeUserId) {
    params.push(excludeUserId)
    where += ` AND id <> $1::uuid`
  }

  const row = await dbQueryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM users WHERE ${where}`,
    params,
  )

  return row?.count ?? 0
}

export async function fetchUserById(userId: string) {
  return dbQueryOne<UserProfile>('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId])
}

export async function getFriendship(userId: string, characterId: string) {
  return dbQueryOne<CharacterFriendship>(
    `
      SELECT *
      FROM character_friendships
      WHERE user_id = $1 AND character_id = $2
      LIMIT 1
    `,
    [userId, characterId],
  )
}

/**
 * Удаление связи по инициативе пользователя. Заблокированную связь удалять
 * нельзя: иначе DELETE + повторный POST вернул бы `accepted` и обошёл блокировку.
 * Возвращаем признак, чтобы API ответил 409, а не притворился успехом.
 */
export async function deleteCharacterFriendship(
  userId: string,
  characterId: string,
): Promise<{ deleted: boolean; blocked: boolean }> {
  const removed = await dbQueryOne<{ id: string }>(
    `DELETE FROM character_friendships
     WHERE user_id = $1 AND character_id = $2 AND status <> 'blocked'
     RETURNING id`,
    [userId, characterId],
  )

  if (removed) return { deleted: true, blocked: false }

  const existing = await getFriendship(userId, characterId)
  return { deleted: false, blocked: existing?.status === 'blocked' }
}

export async function upsertCharacterFriendship(userId: string, characterId: string) {
  return dbQueryOne<CharacterFriendship>(
    `
      INSERT INTO character_friendships (user_id, character_id, status, intimacy_level)
      VALUES ($1, $2, 'accepted', 1)
      ON CONFLICT (user_id, character_id)
      DO UPDATE SET
        status = CASE
          WHEN character_friendships.status = 'blocked' THEN character_friendships.status
          ELSE 'accepted'::character_friendship_status
        END,
        intimacy_level = GREATEST(character_friendships.intimacy_level, 1)
      RETURNING *
    `,
    [userId, characterId],
  )
}

/**
 * Все Character↔User связи для данного персонажа. Используется в Studio
 * для блока «Читатели»: показывает и принятых, и ждущих, и заблокированных —
 * админу нужен полный список, чтобы решать спорные случаи.
 */
export async function listCharacterReaders(characterId: string): Promise<Array<{
  id: string
  user_id: string
  handle: string
  display_name: string
  avatar: string | null
  status: CharacterFriendship['status']
  intimacy_level: number
  created_at: string
}>> {
  return dbQuery<{
    id: string
    user_id: string
    handle: string
    display_name: string
    avatar: string | null
    status: CharacterFriendship['status']
    intimacy_level: number
    created_at: string
  }>(
    `SELECT cf.id, cf.user_id, u.handle, u.display_name, u.avatar,
            cf.status, cf.intimacy_level, cf.created_at
     FROM character_friendships cf
     JOIN users u ON u.id = cf.user_id
     WHERE cf.character_id = $1
     ORDER BY
       CASE cf.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END,
       cf.intimacy_level DESC,
       cf.created_at DESC`,
    [characterId],
  )
}

/**
 * Админская смена статуса Character↔User связи. Отличается от
 * `upsertCharacterFriendship` тем, что явно задаёт статус и не трогает
 * `intimacy_level` (только обновляет до переданного значения).
 * Доп. защита: status ∈ ENUM, иначе 400 на уровне БД.
 */
export async function setCharacterReaderStatus(
  userId: string,
  characterId: string,
  status: CharacterFriendship['status'],
): Promise<CharacterFriendship | null> {
  return dbQueryOne<CharacterFriendship>(
    `UPDATE character_friendships
     SET status = $3::character_friendship_status
     WHERE user_id = $1 AND character_id = $2
     RETURNING *`,
    [userId, characterId, status],
  )
}

/** Жёсткое удаление Character↔User связи (для админских «развести»). */
export async function adminDeleteCharacterFriendship(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const result = await dbQueryOne<{ user_id: string }>(
    `DELETE FROM character_friendships WHERE user_id = $1 AND character_id = $2 RETURNING user_id`,
    [userId, characterId],
  )
  return Boolean(result)
}

/** Только чтение: открытие истории не создаёт диалог и не меняет updated_at. */
export async function fetchCharacterConversation(userId: string, characterId: string) {
  return dbQueryOne<CharacterConversation>(
    `
      SELECT *
      FROM character_conversations
      WHERE user_id = $1 AND character_id = $2
      LIMIT 1
    `,
    [userId, characterId],
  )
}

type MessageMetadata = Record<string, unknown>

function metadataAttempt(metadata: CharacterMessage['metadata']): Record<string, unknown> {
  const attempt = metadata?.attempt
  return attempt && typeof attempt === 'object' && !Array.isArray(attempt)
    ? (attempt as Record<string, unknown>)
    : {}
}

function attemptStatus(metadata: CharacterMessage['metadata']): string | null {
  const status = metadataAttempt(metadata).status
  return typeof status === 'string' ? status : null
}

function requestMatches(metadata: CharacterMessage['metadata'], requestId: string | null): boolean {
  const stored = metadata?.requestId
  if (requestId === null) return typeof stored !== 'string'
  return stored === requestId
}

export type CharacterTurnClaim =
  | { kind: 'start'; conversationId: string; userMessageId: string; retried: boolean }
  | { kind: 'replay'; conversationId: string; text: string }
  | { kind: 'busy'; conversationId: string }
  | { kind: 'conflict'; conversationId: string; reason: 'request_mismatch' }

/**
 * Резервирует один ход под блокировкой строки разговора.
 *
 * JSONB metadata не даёт отдельного уникального индекса по requestId, поэтому
 * это best-effort дедупликация: все новые записи хода идут через эту функцию и
 * одну блокировку. Заявление о строгой exactly-once здесь неуместно.
 */
export async function claimCharacterTurn(input: {
  userId: string
  characterId: string
  requestId: string | null
  content: string
  model: string
  activeTtlSeconds: number
}): Promise<CharacterTurnClaim> {
  const { userId, characterId, requestId, content, model, activeTtlSeconds } = input
  const startedAt = new Date().toISOString()

  return withTransaction(async (client) => {
    // ON CONFLICT DO NOTHING не запускает updated_at-trigger, поэтому чтение
    // истории/резервирование не «оживляет» диалог само по себе.
    await client.query(
      `INSERT INTO character_conversations (user_id, character_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, character_id) DO NOTHING`,
      [userId, characterId],
    )

    const conversationResult = await client.query<CharacterConversation>(
      `SELECT * FROM character_conversations
       WHERE user_id = $1 AND character_id = $2
       FOR UPDATE`,
      [userId, characterId],
    )
    const conversation = conversationResult.rows[0]
    if (!conversation) throw new Error('Conversation unavailable')

    if (requestId) {
      const sameRequest = await client.query<CharacterMessage>(
        `SELECT * FROM character_messages
         WHERE conversation_id = $1 AND metadata->>'requestId' = $2
         ORDER BY created_at ASC, id ASC`,
        [conversation.id, requestId],
      )

      const assistant = [...sameRequest.rows]
        .reverse()
        .find((message) => message.role === 'character')
      if (assistant) {
        return { kind: 'replay', conversationId: conversation.id, text: assistant.content }
      }

      const existingUser = sameRequest.rows.find((message) => message.role === 'user')
      if (existingUser) {
        if (existingUser.content !== content) {
          return { kind: 'conflict', conversationId: conversation.id, reason: 'request_mismatch' }
        }

        const pendingFresh =
          attemptStatus(existingUser.metadata) === 'pending' &&
          Date.now() - new Date(existingUser.created_at).getTime() < activeTtlSeconds * 1000

        if (pendingFresh) {
          return { kind: 'busy', conversationId: conversation.id }
        }

        // Неудачная/зависшая попытка: повторяем тот же вопрос, не дублируя
        // пользовательскую реплику новым requestId.
        const retryMetadata: MessageMetadata = {
          ...(existingUser.metadata ?? {}),
          attempt: {
            ...metadataAttempt(existingUser.metadata),
            status: 'pending',
            startedAt,
            requestedModel: model,
          },
        }
        await client.query(
          'UPDATE character_messages SET metadata = $2::jsonb WHERE id = $1',
          [existingUser.id, JSON.stringify(retryMetadata)],
        )
        await client.query(
          'UPDATE character_conversations SET updated_at = NOW() WHERE id = $1',
          [conversation.id],
        )
        return {
          kind: 'start',
          conversationId: conversation.id,
          userMessageId: existingUser.id,
          retried: true,
        }
      }
    }

    // Один активный ход на диалог: второй таб/повтор получает 409.
    const active = await client.query<{ id: string }>(
      `SELECT id FROM character_messages
       WHERE conversation_id = $1
         AND role = 'user'
         AND metadata->'attempt'->>'status' = 'pending'
         AND created_at > NOW() - ($2::int * INTERVAL '1 second')
       ORDER BY created_at DESC
       LIMIT 1`,
      [conversation.id, activeTtlSeconds],
    )
    if (active.rows[0]) {
      return { kind: 'busy', conversationId: conversation.id }
    }

    const metadata: MessageMetadata = {
      source: 'chat',
      ...(requestId ? { requestId } : {}),
      attempt: { status: 'pending', startedAt, requestedModel: model },
    }

    const inserted = await client.query<CharacterMessage>(
      `INSERT INTO character_messages (conversation_id, role, content, metadata)
       VALUES ($1, 'user', $2, $3::jsonb)
       RETURNING *`,
      [conversation.id, content, JSON.stringify(metadata)],
    )
    const userMessage = inserted.rows[0]
    if (!userMessage) throw new Error('Failed to save chat message')

    await client.query(
      'UPDATE character_conversations SET updated_at = NOW() WHERE id = $1',
      [conversation.id],
    )

    return {
      kind: 'start',
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      retried: false,
    }
  })
}

/**
 * Записывает ответ персонажа только если попытка всё ещё принадлежит этому
 * ходу и её не обогнал более новый вопрос. Поздний onFinish старого запроса
 * поэтому не может дописать текст поверх новой переписки.
 */
export async function completeCharacterTurn(input: {
  conversationId: string
  userMessageId: string
  requestId: string | null
  text: string
  metadata: MessageMetadata
}): Promise<CharacterMessage | null> {
  return withTransaction(async (client) => {
    const locked = await client.query<CharacterMessage>(
      `SELECT * FROM character_messages
       WHERE id = $1 AND conversation_id = $2
       FOR UPDATE`,
      [input.userMessageId, input.conversationId],
    )
    const userMessage = locked.rows[0]
    if (!userMessage || userMessage.role !== 'user') return null
    if (attemptStatus(userMessage.metadata) !== 'pending') return null
    if (!requestMatches(userMessage.metadata, input.requestId)) return null

    const latest = await client.query<{ id: string }>(
      `SELECT id FROM character_messages
       WHERE conversation_id = $1 AND role = 'user'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [input.conversationId],
    )
    if (latest.rows[0]?.id !== input.userMessageId) return null

    const saved = await client.query<CharacterMessage>(
      `INSERT INTO character_messages (conversation_id, role, content, metadata)
       VALUES ($1, 'character', $2, $3::jsonb)
       RETURNING *`,
      [input.conversationId, input.text, JSON.stringify(input.metadata)],
    )

    const completedMetadata: MessageMetadata = {
      ...(userMessage.metadata ?? {}),
      attempt: {
        ...metadataAttempt(userMessage.metadata),
        status: 'completed',
        finishedAt: new Date().toISOString(),
      },
    }
    await client.query(
      'UPDATE character_messages SET metadata = $2::jsonb WHERE id = $1',
      [userMessage.id, JSON.stringify(completedMetadata)],
    )
    await client.query(
      'UPDATE character_conversations SET updated_at = NOW() WHERE id = $1',
      [input.conversationId],
    )

    return saved.rows[0] ?? null
  })
}

/** Неудачная попытка — это состояние metadata, а не реплика персонажа. */
export async function failCharacterTurn(input: {
  conversationId: string
  userMessageId: string
  requestId: string | null
  errorCode: string
}): Promise<void> {
  await withTransaction(async (client) => {
    const locked = await client.query<CharacterMessage>(
      `SELECT * FROM character_messages
       WHERE id = $1 AND conversation_id = $2
       FOR UPDATE`,
      [input.userMessageId, input.conversationId],
    )
    const userMessage = locked.rows[0]
    if (!userMessage || userMessage.role !== 'user') return
    if (attemptStatus(userMessage.metadata) !== 'pending') return
    if (!requestMatches(userMessage.metadata, input.requestId)) return

    const failedMetadata: MessageMetadata = {
      ...(userMessage.metadata ?? {}),
      attempt: {
        ...metadataAttempt(userMessage.metadata),
        status: 'failed',
        errorCode: input.errorCode.slice(0, 100),
        finishedAt: new Date().toISOString(),
      },
    }
    await client.query(
      'UPDATE character_messages SET metadata = $2::jsonb WHERE id = $1',
      [userMessage.id, JSON.stringify(failedMetadata)],
    )
  })
}

export async function fetchConversationMessages(conversationId: string, limit = 40) {
  return dbQuery<CharacterMessage>(
    `
      SELECT *
      FROM (
        SELECT *
        FROM character_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      ) recent
      ORDER BY created_at ASC
    `,
    [conversationId, limit],
  )
}

export async function addCharacterMessage(
  conversationId: string,
  role: 'user' | 'character' | 'system',
  content: string,
  metadata: Record<string, unknown> = {},
) {
  return dbQueryOne<CharacterMessage>(
    `
      INSERT INTO character_messages (conversation_id, role, content, metadata)
      VALUES ($1, $2::character_message_role, $3, $4::jsonb)
      RETURNING *
    `,
    [conversationId, role, content, JSON.stringify(metadata)],
  )
}

export async function fetchReaderProfileSummary(userId: string) {
  const [publicRole, friendships, conversations, highlights] = await Promise.all([
    dbQueryOne<{ public_role: PublicRole }>(
      'SELECT public_role FROM users WHERE id = $1 LIMIT 1',
      [userId],
    ).then(row => row?.public_role ?? 'reader'),
    dbQuery<{
      id: string
      character_id: string
      status: string
      intimacy_level: number
      character_name: string
      character_slug: string
      character_avatar: string | null
      character_bio: string | null
    }>(
      `
        SELECT
          f.id,
          f.character_id,
          f.status,
          f.intimacy_level,
          c.name AS character_name,
          c.slug AS character_slug,
          c.avatar AS character_avatar,
          c.bio AS character_bio
        FROM character_friendships f
        JOIN characters c ON c.id = f.character_id
        WHERE f.user_id = $1
        ORDER BY f.updated_at DESC
      `,
      [userId],
    ),
    dbQuery<{
      id: string
      character_id: string
      updated_at: string
      character_name: string
      character_slug: string
      character_avatar: string | null
      last_message: string | null
    }>(
      `
        SELECT
          cc.id,
          cc.character_id,
          cc.updated_at,
          c.name AS character_name,
          c.slug AS character_slug,
          c.avatar AS character_avatar,
          (
            SELECT cm.content
            FROM character_messages cm
            WHERE cm.conversation_id = cc.id
            ORDER BY cm.created_at DESC
            LIMIT 1
          ) AS last_message
        FROM character_conversations cc
        JOIN characters c ON c.id = cc.character_id
        WHERE cc.user_id = $1
        ORDER BY cc.updated_at DESC
        LIMIT 12
      `,
      [userId],
    ),
    fetchUserHighlights(userId, 50),
  ])

  return { publicRole, friendships, conversations, highlights }
}
