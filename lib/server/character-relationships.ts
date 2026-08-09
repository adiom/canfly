import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'

/**
 * Репозиторий для связей Character↔Character (`character_relationships`).
 *
 * Особенности модели:
 *   - Одна строка = одно направление (A → B). Взаимность — это отдельная
 *     строка B → A; в публичных карточках помечаем вычисляемым флагом
 *     `is_mutual` через `fetchCharacterRelationshipsWithMutualFlag`.
 *   - UNIQUE(character_id, related_character_id) в БД уже защищает от дублей.
 *   - При удалении связи каскад срабатывает через FK ON DELETE CASCADE
 *     в `postgres/schema.sql`, дополнительной чистки не нужно.
 *
 * Все мутации принимают `actorId` — id автора, выполняющего действие.
 * Проверки прав делаются в server actions (`requireStudioSession` и т.п.);
 * здесь только данные.
 */

export interface CharacterRelationshipRow {
  id: string
  character_id: string
  related_character_id: string
  relationship_type: string
  description: string | null
  created_at: string
}

/** Связь вместе с данными цели — для отрисовки карточки. */
export interface CharacterRelationshipWithTarget extends CharacterRelationshipRow {
  related_name: string
  related_slug: string
  related_avatar: string | null
  related_type: 'person' | 'city'
}

/** Связь + флаг взаимности + тип обратной связи, если есть. */
export interface CharacterRelationshipWithMutual extends CharacterRelationshipWithTarget {
  is_mutual: boolean
  inverse_type: string | null
}

interface RawWithMutual extends CharacterRelationshipWithTarget {
  is_mutual: boolean | string
  inverse_type: string | null
}

function normalizeMutual(row: RawWithMutual): CharacterRelationshipWithMutual {
  return { ...row, is_mutual: row.is_mutual === true || row.is_mutual === 't' }
}

/**
 * Все исходящие связи персонажа (A → B), с данными цели и пометкой взаимности.
 *
 * Взаимность = `EXISTS(SELECT 1 FROM character_relationships WHERE
 * character_id = r.related_character_id AND related_character_id = r.character_id)`.
 * Считается в SQL — на одну секунду быстрее, чем N+1.
 */
export async function fetchCharacterRelationships(
  characterId: string,
): Promise<CharacterRelationshipWithMutual[]> {
  const rows = await dbQuery<RawWithMutual>(
    `SELECT r.id, r.character_id, r.related_character_id,
            r.relationship_type, r.description, r.created_at,
            c.name AS related_name,
            c.slug AS related_slug,
            c.avatar AS related_avatar,
            c.character_type AS related_type,
            EXISTS (
              SELECT 1 FROM character_relationships inv
              WHERE inv.character_id = r.related_character_id
                AND inv.related_character_id = r.character_id
            ) AS is_mutual,
            (
              SELECT inv.relationship_type FROM character_relationships inv
              WHERE inv.character_id = r.related_character_id
                AND inv.related_character_id = r.character_id
              LIMIT 1
            ) AS inverse_type
     FROM character_relationships r
     JOIN characters c ON c.id = r.related_character_id
     WHERE r.character_id = $1
     ORDER BY r.created_at DESC`,
    [characterId],
  )
  return rows.map(normalizeMutual)
}

/**
 * Только исходящие связи без JOIN по цели — лёгкий набор для фоновых задач.
 * Используется в JSON-LD и там, где имя цели не нужно.
 */
export async function fetchCharacterRelationshipsRaw(
  characterId: string,
): Promise<CharacterRelationshipRow[]> {
  return dbQuery<CharacterRelationshipRow>(
    `SELECT id, character_id, related_character_id, relationship_type, description, created_at
     FROM character_relationships
     WHERE character_id = $1
     ORDER BY created_at DESC`,
    [characterId],
  )
}

/**
 * Upsert связи: если строка (character_id, related_character_id) уже есть —
 * обновляем тип и описание, иначе вставляем.
 *
 * Возвращает строку после записи. Если связь уже существовала и не изменилась —
 * возвращаем существующую, без лишнего UPDATE (оптимизация под частые сабмиты).
 */
export async function upsertCharacterRelationship(input: {
  characterId: string
  relatedCharacterId: string
  relationshipType: string
  description: string | null
}): Promise<CharacterRelationshipRow> {
  return withTransaction(async (client) => {
    const existing = await client.query<CharacterRelationshipRow>(
      `SELECT id, character_id, related_character_id, relationship_type, description, created_at
       FROM character_relationships
       WHERE character_id = $1 AND related_character_id = $2
       FOR UPDATE`,
      [input.characterId, input.relatedCharacterId],
    )

    if (existing.rows[0]) {
      const row = existing.rows[0]
      if (
        row.relationship_type === input.relationshipType &&
        (row.description ?? null) === input.description
      ) {
        return row
      }
      const updated = await client.query<CharacterRelationshipRow>(
        `UPDATE character_relationships
         SET relationship_type = $3, description = $4
         WHERE id = $1 AND character_id = $2
         RETURNING id, character_id, related_character_id, relationship_type, description, created_at`,
        [row.id, input.characterId, input.relationshipType, input.description],
      )
      return updated.rows[0]
    }

    const inserted = await client.query<CharacterRelationshipRow>(
      `INSERT INTO character_relationships (character_id, related_character_id, relationship_type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, character_id, related_character_id, relationship_type, description, created_at`,
      [input.characterId, input.relatedCharacterId, input.relationshipType, input.description],
    )
    return inserted.rows[0]
  })
}

/**
 * Удалить связь по id. Дополнительно проверяем, что связь действительно
 * принадлежит персонажу `characterId` — иначе можно удалить чужую строку,
 * подменив id в форме.
 */
export async function deleteCharacterRelationship(
  relationshipId: string,
  characterId: string,
): Promise<boolean> {
  const result = await dbQueryOne<{ id: string }>(
    `DELETE FROM character_relationships
     WHERE id = $1 AND character_id = $2
     RETURNING id`,
    [relationshipId, characterId],
  )
  return Boolean(result)
}

/**
 * Поиск персонажей по имени/слагу для формы «выберите цель связи».
 * Простой ILIKE — список обычно маленький, индекса не требуется.
 */
export async function searchCharactersForRelationship(input: {
  excludeCharacterId: string
  query: string
  limit?: number
}): Promise<Array<{ id: string; name: string; slug: string; avatar: string | null; character_type: 'person' | 'city' }>> {
  const limit = input.limit ?? 12
  const term = input.query.trim()
  if (!term) return []

  return dbQuery<{ id: string; name: string; slug: string; avatar: string | null; character_type: 'person' | 'city' }>(
    `SELECT id, name, slug, avatar, character_type
     FROM characters
     WHERE id <> $1
       AND (name ILIKE $2 OR slug ILIKE $2)
     ORDER BY name
     LIMIT $3`,
    [input.excludeCharacterId, `%${term}%`, limit],
  )
}
