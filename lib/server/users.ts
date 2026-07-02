import { randomBytes, pbkdf2 } from 'crypto'
import { dbQuery, dbQueryOne } from '@/lib/db'
import { getUserRoles } from '@/lib/server/session'

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, 120000, 32, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(`pbkdf2$120000$${salt.toString('base64url')}$${key.toString('base64url')}`)
    })
  })
}
import {
  AdminUserProfile,
  CharacterConversation,
  CharacterFriendship,
  CharacterMessage,
  UserProfile,
  UserRole,
} from '@/lib/types'
import { fetchUserHighlights } from './chapter-highlights'

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
  roles?: UserRole[]
}) {
  const handle = data.login
  const passwordHash = await hashPassword(data.password)
  const user = await dbQueryOne<UserProfile>(
    `
      INSERT INTO users (login, password_hash, handle, display_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [data.login, passwordHash, handle, data.displayName || data.login],
  )

  if (!user) {
    throw new Error('Failed to create user')
  }

  const roles: UserRole[] = data.roles?.length ? data.roles : ['reader']
  await setUserRoles(user.id, roles)

  return user
}

export async function setUserRoles(userId: string, roles: UserRole[]) {
  const normalizedRoles = Array.from(new Set(roles)).filter((role): role is UserRole =>
    ['reader', 'author', 'editor', 'admin'].includes(role),
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
        u.is_deleted,
        u.deleted_at,
        u.created_at,
        u.updated_at,
        COALESCE(
          array_agg(ur.role::text ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
          ARRAY[]::text[]
        ) AS roles,
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
  let where = `WHERE role = 'admin'`
  if (excludeUserId) {
    params.push(excludeUserId)
    where += ` AND user_id <> $1::uuid`
  }

  const row = await dbQueryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT user_id)::int AS count FROM user_roles ${where}`,
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

export async function deleteCharacterFriendship(userId: string, characterId: string) {
  await dbQuery(
    'DELETE FROM character_friendships WHERE user_id = $1 AND character_id = $2',
    [userId, characterId],
  )
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

export async function getOrCreateCharacterConversation(userId: string, characterId: string) {
  return dbQueryOne<CharacterConversation>(
    `
      INSERT INTO character_conversations (user_id, character_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, character_id)
      DO UPDATE SET updated_at = NOW()
      RETURNING *
    `,
    [userId, characterId],
  )
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
  const [roles, friendships, conversations, highlights] = await Promise.all([
    getUserRoles(userId),
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

  return { roles, friendships, conversations, highlights }
}
