import { dbQuery, dbQueryOne } from '@/lib/db'
import {
  mergeCharacterAiRuntimeConfig,
  type CharacterAiRuntimeConfig,
  type CharacterAiSettingsValues,
} from '@/lib/ai/character-chat/config'
import type { CharacterAiSettingsInput } from '@/lib/schemas/character-ai'

/**
 * Технические настройки AI-чата. Единственная копия — `character_ai_settings`
 * (аддитивная миграция 033). Здесь нет prompt или `ai_enabled`: авторская
 * инструкция живёт в `characters.system_role`, доступность выводится из
 * существующих полей.
 *
 * До применения миграции репозиторий не падает: отсутствие таблицы — это
 * явный статус `missing`, а runtime использует документированные defaults.
 */
export type CharacterAiSettingsSchemaStatus = 'available' | 'missing' | 'error'

export interface CharacterAiSettingsRow extends CharacterAiSettingsValues {
  character_id: string
  revision: number
  updated_by: string | null
  updated_at: string | Date
}

export interface CharacterAiSettingsRead {
  schema: CharacterAiSettingsSchemaStatus
  settings: CharacterAiSettingsRow | null
}

const SETTINGS_COLUMNS = `
  character_id,
  model_id,
  temperature::float8 AS temperature,
  max_output_tokens,
  total_timeout_ms,
  chunk_timeout_ms,
  user_turns_per_hour,
  revision,
  updated_by,
  updated_at
`

function isMissingSchemaError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '42P01'
  )
}

function logSettingsError(context: string, error: unknown) {
  console.error(`[character ai settings] ${context}`, error instanceof Error ? error.message : error)
}

export async function getCharacterAiSettings(characterId: string): Promise<CharacterAiSettingsRead> {
  try {
    const settings = await dbQueryOne<CharacterAiSettingsRow>(
      `SELECT ${SETTINGS_COLUMNS}
       FROM character_ai_settings
       WHERE character_id = $1
       LIMIT 1`,
      [characterId],
    )
    return { schema: 'available', settings }
  } catch (error) {
    if (isMissingSchemaError(error)) return { schema: 'missing', settings: null }
    logSettingsError('read failed', error)
    return { schema: 'error', settings: null }
  }
}

export async function listCharacterAiSettings(characterIds: string[]): Promise<{
  schema: CharacterAiSettingsSchemaStatus
  settingsByCharacter: Map<string, CharacterAiSettingsRow>
}> {
  const settingsByCharacter = new Map<string, CharacterAiSettingsRow>()
  if (characterIds.length === 0) {
    return { schema: 'available', settingsByCharacter }
  }

  try {
    const rows = await dbQuery<CharacterAiSettingsRow>(
      `SELECT ${SETTINGS_COLUMNS}
       FROM character_ai_settings
       WHERE character_id = ANY($1::uuid[])`,
      [characterIds],
    )
    for (const row of rows) settingsByCharacter.set(row.character_id, row)
    return { schema: 'available', settingsByCharacter }
  } catch (error) {
    if (isMissingSchemaError(error)) return { schema: 'missing', settingsByCharacter }
    logSettingsError('list failed', error)
    return { schema: 'error', settingsByCharacter }
  }
}

/**
 * Единый resolver для runtime чата и Studio. Значения из БД проверяются в
 * `mergeCharacterAiRuntimeConfig`, поэтому панель и генерация не расходятся.
 */
export async function resolveCharacterAiRuntimeConfig(characterId: string): Promise<{
  config: CharacterAiRuntimeConfig
  settings: CharacterAiSettingsRow | null
  schema: CharacterAiSettingsSchemaStatus
  source: 'character' | 'default'
}> {
  const read = await getCharacterAiSettings(characterId)
  return {
    config: mergeCharacterAiRuntimeConfig(read.settings),
    settings: read.settings,
    schema: read.schema,
    source: read.settings ? 'character' : 'default',
  }
}

export async function saveCharacterAiSettings(
  input: CharacterAiSettingsInput & { updatedBy: string },
): Promise<{ saved: boolean; schema: CharacterAiSettingsSchemaStatus; settings: CharacterAiSettingsRow | null }> {
  try {
    const settings = await dbQueryOne<CharacterAiSettingsRow>(
      `INSERT INTO character_ai_settings (
         character_id, model_id, temperature, max_output_tokens,
         total_timeout_ms, chunk_timeout_ms, user_turns_per_hour, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (character_id) DO UPDATE SET
         model_id = EXCLUDED.model_id,
         temperature = EXCLUDED.temperature,
         max_output_tokens = EXCLUDED.max_output_tokens,
         total_timeout_ms = EXCLUDED.total_timeout_ms,
         chunk_timeout_ms = EXCLUDED.chunk_timeout_ms,
         user_turns_per_hour = EXCLUDED.user_turns_per_hour,
         updated_by = EXCLUDED.updated_by,
         revision = character_ai_settings.revision + 1,
         updated_at = NOW()
       RETURNING ${SETTINGS_COLUMNS}`,
      [
        input.characterId,
        input.modelId,
        input.temperature,
        input.maxOutputTokens,
        input.totalTimeoutMs,
        input.chunkTimeoutMs,
        input.userTurnsPerHour,
        input.updatedBy,
      ],
    )
    return { saved: Boolean(settings), schema: 'available', settings }
  } catch (error) {
    if (isMissingSchemaError(error)) return { saved: false, schema: 'missing', settings: null }
    logSettingsError('save failed', error)
    return { saved: false, schema: 'error', settings: null }
  }
}
