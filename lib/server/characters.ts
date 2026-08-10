import { dbQuery, dbQueryOne, dbUpdatePartial } from '@/lib/db'
import type { UpdatableColumn } from '@/lib/db'
import {
  Character,
  CharacterFriendSummary,
  CharacterRelationship,
  CharacterRelationshipWithTarget,
  CharacterStats,
} from '@/lib/types'

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
