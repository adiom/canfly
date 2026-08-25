import { dbQuery, dbQueryOne } from '@/lib/db'

/**
 * Версия паспорта персонажа. Хранится в character_passport_versions (миграция 025).
 * Текущий паспорт живёт в characters.passport (markdown), эта таблица — только
 * история прошлых ревизий. По образцу chapter_versions (lib/server/chapters.ts).
 */
export interface CharacterPassportVersion {
  id: string
  character_id: string
  content: string
  version_number: number
  created_at: string
}

/**
 * Сохраняет ревизию паспорта (старое содержимое перед перезаписью).
 * Номер версии — монотонно растущий на персонажа: max + 1.
 */
export async function createPassportVersion(characterId: string, content: string) {
  const last = await dbQueryOne<{ version_number: number }>(
    `SELECT version_number FROM character_passport_versions
     WHERE character_id = $1 ORDER BY version_number DESC LIMIT 1`,
    [characterId],
  )
  const nextVersion = (last?.version_number ?? 0) + 1

  return dbQueryOne<CharacterPassportVersion>(
    `INSERT INTO character_passport_versions (character_id, content, version_number)
     VALUES ($1, $2, $3)
     RETURNING id, character_id, content, version_number, created_at`,
    [characterId, content, nextVersion],
  )
}

/** Есть ли хотя бы одна сохранённая ревизия паспорта — для life-state «созревает». */
export async function hasPassportHistory(characterId: string): Promise<boolean> {
  const row = await dbQueryOne<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM character_passport_versions WHERE character_id = $1',
    [characterId],
  )
  return row ? Number(row.count) > 0 : false
}

/** История ревизий паспорта — от новых к старым. */
export async function fetchPassportVersions(characterId: string) {
  return dbQuery<CharacterPassportVersion>(
    `SELECT id, character_id, content, version_number, created_at
     FROM character_passport_versions
     WHERE character_id = $1
     ORDER BY version_number DESC`,
    [characterId],
  )
}

/** Одна ревизия по id. */
export async function fetchPassportVersion(versionId: string) {
  return dbQueryOne<CharacterPassportVersion>(
    `SELECT id, character_id, content, version_number, created_at
     FROM character_passport_versions WHERE id = $1 LIMIT 1`,
    [versionId],
  )
}

/**
 * Восстановление ревизии: сохраняет текущий паспорт как новую ревизию (чтобы
 * откат тоже остался в истории), затем пишет содержимое выбранной версии в
 * characters.passport. Возвращает обновлённый passport, не весь персонаж.
 */
export async function restorePassportVersion(
  characterId: string,
  versionId: string,
) {
  const version = await fetchPassportVersion(versionId)
  if (!version || version.character_id !== characterId) return null

  // Текущий паспорт уходит в историю перед откатом — откат тоже обратим.
  const current = await dbQueryOne<{ passport: string | null }>(
    'SELECT passport FROM characters WHERE id = $1',
    [characterId],
  )
  if (current?.passport) {
    await createPassportVersion(characterId, current.passport)
  }

  return dbQueryOne<{ id: string; passport: string | null }>(
    `UPDATE characters SET passport = $2 WHERE id = $1
     RETURNING id, passport`,
    [characterId, version.content],
  )
}
