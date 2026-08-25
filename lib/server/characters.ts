import { dbQuery, dbQueryOne, dbUpdatePartial } from '@/lib/db'
import type { UpdatableColumn } from '@/lib/db'
import {
  Character,
  CharacterFriendSummary,
  CharacterRelationship,
  CharacterRelationshipWithTarget,
  CharacterStats,
} from '@/lib/types'
import type { CharacterListRole } from '@/lib/releases-types'

export async function fetchCharactersList(): Promise<Character[]> {
  return dbQuery<Character>(
    'SELECT * FROM characters WHERE character_type = \'person\' ORDER BY created_at DESC',
  )
}

/** Публичный каталог: люди и города литературной вселенной. */
export async function fetchPublicCharactersList(): Promise<Character[]> {
  return dbQuery<Character>(
    `SELECT * FROM characters
     WHERE character_type IN ('person', 'city')
     ORDER BY created_at DESC`,
  )
}

export async function fetchCitiesList(): Promise<Character[]> {
  return dbQuery<Character>(
    'SELECT * FROM characters WHERE character_type = \'city\' ORDER BY created_at DESC',
  )
}

export async function fetchAllCharactersList(): Promise<Character[]> {
  return dbQuery<Character>('SELECT * FROM characters ORDER BY created_at DESC')
}

export async function fetchRelationshipsForCharacters(
  characterIds: string[],
): Promise<CharacterRelationship[]> {
  if (characterIds.length === 0) {
    return []
  }

  return dbQuery<CharacterRelationship>(
    'SELECT * FROM character_relationships WHERE character_id = ANY($1::uuid[])',
    [characterIds],
  )
}

export async function fetchCharacterBySlug(slug: string): Promise<{
  character: Character
  relationships: CharacterRelationshipWithTarget[]
} | null> {
  const character = await dbQueryOne<Character>('SELECT * FROM characters WHERE slug = $1 LIMIT 1', [
    slug,
  ])

  if (!character) {
    return null
  }

  // JOIN, а не голый uuid: связь без имени героя на странице бесполезна
  const relationships = await dbQuery<CharacterRelationshipWithTarget>(
    `SELECT r.*,
            c.name AS related_name,
            c.slug AS related_slug,
            c.avatar AS related_avatar,
            c.character_type AS related_type
     FROM character_relationships r
     JOIN characters c ON c.id = r.related_character_id
     WHERE r.character_id = $1
     ORDER BY c.name`,
    [character.id],
  )

  return {
    character,
    relationships,
  }
}

export async function fetchCharacterById(id: string) {
  return dbQueryOne<Character>('SELECT * FROM characters WHERE id = $1 LIMIT 1', [id])
}

export async function fetchCharacterStats(characterId: string): Promise<CharacterStats> {
  const [friendsRow, postsRow, relationsRow] = await Promise.all([
    dbQueryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM character_friendships
       WHERE character_id = $1 AND status = 'accepted'`,
      [characterId],
    ),
    dbQueryOne<{ count: string; last_spoke_at: string | null }>(
      `SELECT COUNT(*)::text AS count,
              MAX(COALESCE(scheduled_at, created_at)) AS last_spoke_at
       FROM character_posts
       WHERE character_id = $1
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())`,
      [characterId],
    ),
    dbQueryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM character_relationships
       WHERE character_id = $1`,
      [characterId],
    ),
  ])

  return {
    friends: friendsRow ? Number(friendsRow.count) : 0,
    posts: postsRow ? Number(postsRow.count) : 0,
    relations: relationsRow ? Number(relationsRow.count) : 0,
    last_spoke_at: postsRow?.last_spoke_at ?? null,
  }
}

export async function fetchCharacterFriends(
  characterId: string,
  limit = 12,
): Promise<CharacterFriendSummary[]> {
  return dbQuery<CharacterFriendSummary>(
    `
      SELECT
        u.id,
        u.handle,
        u.display_name,
        u.avatar,
        cf.intimacy_level
      FROM character_friendships cf
      JOIN users u ON u.id = cf.user_id
      WHERE cf.character_id = $1 AND cf.status = 'accepted'
      ORDER BY cf.intimacy_level DESC, cf.created_at DESC
      LIMIT $2
    `,
    [characterId, limit],
  )
}

export async function createCharacter(data: Record<string, unknown>) {
  return dbQueryOne<Character>(
    `
      INSERT INTO characters (
        name,
        slug,
        avatar,
        bio,
        full_description,
        abilities,
        speaking_style,
        personality,
        boundaries,
        knowledge_scope,
        spoiler_policy,
        system_role,
        reply_mode,
        can_receive_messages,
        character_type,
        passport,
        map_image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13::character_reply_mode, $14, $15::character_type, $16, $17)
      RETURNING *
    `,
    [
      data.name,
      data.slug,
      data.avatar,
      data.bio,
      data.full_description,
      JSON.stringify(data.abilities ?? []),
      data.speaking_style,
      data.personality,
      data.boundaries,
      data.knowledge_scope,
      data.spoiler_policy,
      data.system_role ?? '',
      data.reply_mode ?? 'ai_auto',
      data.can_receive_messages ?? true,
      data.character_type ?? 'person',
      data.passport,
      data.map_image_url,
    ],
  )
}

const characterUpdatable: Record<string, UpdatableColumn> = {
  name: { column: 'name' },
  slug: { column: 'slug' },
  avatar: { column: 'avatar' },
  bio: { column: 'bio' },
  full_description: { column: 'full_description' },
  abilities: {
    column: 'abilities',
    cast: '::jsonb',
    serialize: (value) => JSON.stringify(value ?? []),
  },
  speaking_style: { column: 'speaking_style' },
  personality: { column: 'personality' },
  boundaries: { column: 'boundaries' },
  knowledge_scope: { column: 'knowledge_scope' },
  spoiler_policy: { column: 'spoiler_policy' },
  system_role: { column: 'system_role' },
  reply_mode: { column: 'reply_mode', cast: '::character_reply_mode' },
  can_receive_messages: { column: 'can_receive_messages' },
  character_type: { column: 'character_type', cast: '::character_type' },
  passport: { column: 'passport' },
  map_image_url: { column: 'map_image_url' },
}

/** Частичный апдейт: непереданные поля сохраняют текущее значение. */
export async function updateCharacter(id: string, data: Record<string, unknown>) {
  return dbUpdatePartial<Character>({
    table: 'characters',
    id,
    data,
    columns: characterUpdatable,
    returning: '*',
  })
}

export async function updatePassport(id: string, passport: string | null) {
  return dbQueryOne<Character>(
    'UPDATE characters SET passport = $2 WHERE id = $1 RETURNING *',
    [id, passport],
  )
}

export async function deleteCharacter(id: string) {
  await dbQuery('DELETE FROM characters WHERE id = $1', [id])
}

// === Выборки с фильтром по релизу/серии/роли ===
//
// Дефолт /characters = только главные герои опубликованных релизов
// (role = 'main'). Чисто supporting/cameo — через ?role=… или ?release=…&role=….
// Все JOIN'ы отсекают r.status != 'published', чтобы draft-релизы автора
// не проталкивали персонажей в публичный каталог.

const MAIN_CHARACTERS_SQL = `
  SELECT DISTINCT c.*
  FROM characters c
  JOIN release_characters rc ON rc.character_id = c.id
  JOIN releases r ON r.id = rc.release_id
  WHERE c.character_type = 'person'
    AND rc.role = 'main'
    AND r.status = 'published'
  ORDER BY c.created_at DESC
`

/** Главные герои опубликованных релизов — дефолтная выдача /characters. */
export async function fetchMainCharacters(): Promise<Character[]> {
  return dbQuery<Character>(MAIN_CHARACTERS_SQL)
}

/**
 * Персонажи с любой ролью в опубликованном релизе; фильтр по роли опционален.
 * 'all' — без фильтра по роли, но персонаж без связей в release_characters
 * сюда не попадёт (см. соглашение в плане: «без выпуска» не показываем).
 */
export async function fetchCharactersByRole(role: CharacterListRole): Promise<Character[]> {
  if (role === 'all') {
    return dbQuery<Character>(`
      SELECT DISTINCT c.*
      FROM characters c
      JOIN release_characters rc ON rc.character_id = c.id
      JOIN releases r ON r.id = rc.release_id
      WHERE c.character_type = 'person'
        AND r.status = 'published'
      ORDER BY c.created_at DESC
    `)
  }
  return dbQuery<Character>(
    `
      SELECT DISTINCT c.*
      FROM characters c
      JOIN release_characters rc ON rc.character_id = c.id
      JOIN releases r ON r.id = rc.release_id
      WHERE c.character_type = 'person'
        AND r.status = 'published'
        AND rc.role = $1::release_character_role
      ORDER BY c.created_at DESC
    `,
    [role],
  )
}

/** Персонажи конкретного релиза (по slug), опционально с фильтром по роли. */
export async function fetchCharactersByReleaseSlug(
  slug: string,
  role: CharacterListRole = 'all',
): Promise<Character[]> {
  const params: unknown[] = [slug]
  const roleClause = role === 'all' ? '' : 'AND rc.role = $2::release_character_role'
  if (role !== 'all') params.push(role)
  return dbQuery<Character>(
    `
      SELECT DISTINCT c.*
      FROM characters c
      JOIN release_characters rc ON rc.character_id = c.id
      JOIN releases r ON r.id = rc.release_id
      WHERE r.slug = $1
        AND r.status = 'published'
        ${roleClause}
      ORDER BY c.name
    `,
    params,
  )
}

/** Персонажи серии (по slug серии), опционально с фильтром по роли. */
export async function fetchCharactersBySeriesSlug(
  slug: string,
  role: CharacterListRole = 'all',
): Promise<Character[]> {
  const params: unknown[] = [slug]
  const roleClause = role === 'all' ? '' : 'AND rc.role = $2::release_character_role'
  if (role !== 'all') params.push(role)
  return dbQuery<Character>(
    `
      SELECT DISTINCT c.*
      FROM characters c
      JOIN release_characters rc ON rc.character_id = c.id
      JOIN releases r ON r.id = rc.release_id
      JOIN release_series rs ON rs.release_id = r.id
      JOIN series s ON s.id = rs.series_id
      WHERE s.slug = $1
        AND r.status = 'published'
        ${roleClause}
      ORDER BY c.name
    `,
    params,
  )
}
