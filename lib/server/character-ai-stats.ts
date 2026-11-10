import { dbQuery } from '@/lib/db'
import {
  mapCharacterAiLastError,
  mapCharacterAiStats,
  type CharacterAiLastError,
  type CharacterAiLastErrorRow,
  type CharacterAiStats,
  type CharacterAiStatsRow,
} from '@/lib/ai/character-chat/insights'

/**
 * Агрегаты AI-чата по metadata первого этапа. Тексты сообщений не читаются:
 * запросы возвращают только счётчики, время, коды ошибок и usage.
 *
 * Период 30 дней ограничивает «последние попытки», но общие счётчики
 * диалогов/читателей/сообщений остаются накопительными. Это осознанно:
 * панель не должна сканировать всю историю на каждый рендер и не выдаёт
 * отсутствующий usage за ноль.
 */
const STATS_SQL = `
  WITH scoped AS (
    SELECT cc.id AS conversation_id, cc.character_id, cc.user_id
    FROM character_conversations cc
    WHERE cc.character_id = ANY($1::uuid[])
  )
  SELECT
    s.character_id,
    COUNT(DISTINCT s.conversation_id)::int AS conversations,
    COUNT(DISTINCT s.user_id)::int AS readers,
    COUNT(m.id)::int AS messages,
    COUNT(m.id) FILTER (WHERE m.role = 'user')::int AS user_messages,
    COUNT(m.id) FILTER (WHERE m.role = 'character')::int AS answers,
    COUNT(m.id) FILTER (
      WHERE m.role = 'user'
        AND m.created_at >= NOW() - INTERVAL '30 days'
    )::int AS requests_30d,
    COUNT(m.id) FILTER (
      WHERE m.role = 'user'
        AND m.created_at >= NOW() - INTERVAL '30 days'
        AND m.metadata->'attempt'->>'status' = 'completed'
    )::int AS completed_30d,
    COUNT(m.id) FILTER (
      WHERE m.role = 'user'
        AND m.created_at >= NOW() - INTERVAL '30 days'
        AND m.metadata->'attempt'->>'status' = 'failed'
    )::int AS failed_30d,
    COUNT(m.id) FILTER (
      WHERE m.role = 'user'
        AND m.metadata->'attempt'->>'status' = 'pending'
        AND m.created_at >= NOW() - INTERVAL '120 seconds'
    )::int AS pending_now,
    MAX(m.created_at) FILTER (WHERE m.role = 'character') AS last_answer_at,
    SUM(
      CASE
        WHEN m.role = 'character'
          AND jsonb_typeof(m.metadata->'usage'->'inputTokens') = 'number'
        THEN (m.metadata->'usage'->>'inputTokens')::bigint
        ELSE 0
      END
    ) AS input_tokens,
    SUM(
      CASE
        WHEN m.role = 'character'
          AND jsonb_typeof(m.metadata->'usage'->'outputTokens') = 'number'
        THEN (m.metadata->'usage'->>'outputTokens')::bigint
        ELSE 0
      END
    ) AS output_tokens,
    COUNT(m.id) FILTER (
      WHERE m.role = 'character'
        AND jsonb_typeof(m.metadata->'usage'->'totalTokens') = 'number'
    )::int AS metered_answers,
    COUNT(m.id) FILTER (
      WHERE m.role = 'character'
        AND jsonb_typeof(m.metadata->'usage'->'totalTokens') IS DISTINCT FROM 'number'
    )::int AS unmetered_answers
  FROM scoped s
  LEFT JOIN character_messages m ON m.conversation_id = s.conversation_id
  GROUP BY s.character_id
`

const LAST_ERROR_SQL = `
  SELECT DISTINCT ON (cc.character_id)
    cc.character_id,
    m.metadata->'attempt'->>'errorCode' AS error_code,
    m.created_at AS failed_at
  FROM character_messages m
  JOIN character_conversations cc ON cc.id = m.conversation_id
  WHERE cc.character_id = ANY($1::uuid[])
    AND m.role = 'user'
    AND m.metadata->'attempt'->>'status' = 'failed'
  ORDER BY cc.character_id, m.created_at DESC
`

const BLOCKED_READERS_SQL = `
  SELECT character_id, COUNT(*)::int AS blocked_readers
  FROM character_friendships
  WHERE character_id = ANY($1::uuid[])
    AND status = 'blocked'
  GROUP BY character_id
`

export interface CharacterAiStatsRead {
  /** `false` — запрос не выполнился; UI обязан показать «нет данных», а не нули. */
  ok: boolean
  statsByCharacter: Map<string, CharacterAiStats>
}

export interface CharacterAiErrorsRead {
  ok: boolean
  errorsByCharacter: Map<string, CharacterAiLastError>
}

export async function fetchCharacterAiStats(
  characterIds: string[],
): Promise<CharacterAiStatsRead> {
  if (characterIds.length === 0) {
    return { ok: true, statsByCharacter: new Map() }
  }

  try {
    const rows = await dbQuery<CharacterAiStatsRow>(STATS_SQL, [characterIds])
    const statsByCharacter = new Map<string, CharacterAiStats>()
    for (const row of rows) {
      statsByCharacter.set(row.character_id, mapCharacterAiStats(row))
    }
    return { ok: true, statsByCharacter }
  } catch (error) {
    console.error(
      '[character ai stats] aggregate failed',
      error instanceof Error ? error.message : error,
    )
    return { ok: false, statsByCharacter: new Map() }
  }
}

export async function fetchCharacterAiLastErrors(
  characterIds: string[],
): Promise<CharacterAiErrorsRead> {
  if (characterIds.length === 0) {
    return { ok: true, errorsByCharacter: new Map() }
  }

  try {
    const rows = await dbQuery<CharacterAiLastErrorRow>(LAST_ERROR_SQL, [characterIds])
    const errorsByCharacter = new Map<string, CharacterAiLastError>()
    for (const row of rows) {
      const error = mapCharacterAiLastError(row)
      if (error) errorsByCharacter.set(row.character_id, error)
    }
    return { ok: true, errorsByCharacter }
  } catch (error) {
    console.error(
      '[character ai stats] last error query failed',
      error instanceof Error ? error.message : error,
    )
    return { ok: false, errorsByCharacter: new Map() }
  }
}

export async function fetchCharacterAiBlockedReaders(
  characterIds: string[],
): Promise<{ ok: boolean; blockedByCharacter: Map<string, number> }> {
  if (characterIds.length === 0) {
    return { ok: true, blockedByCharacter: new Map() }
  }

  try {
    const rows = await dbQuery<{ character_id: string; blocked_readers: number }>(
      BLOCKED_READERS_SQL,
      [characterIds],
    )
    const blockedByCharacter = new Map<string, number>()
    for (const row of rows) {
      blockedByCharacter.set(row.character_id, Number(row.blocked_readers) || 0)
    }
    return { ok: true, blockedByCharacter }
  } catch (error) {
    console.error(
      '[character ai stats] blocked readers query failed',
      error instanceof Error ? error.message : error,
    )
    return { ok: false, blockedByCharacter: new Map() }
  }
}
