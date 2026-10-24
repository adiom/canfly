import { dbQuery, dbQueryOne } from '@/lib/db'
import type { ReadingPosition } from '@/lib/reader/reading-position'

let hasPositionColumn = false

async function supportsPosition() {
  if (hasPositionColumn) return true
  const row = await dbQueryOne<{ supported: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'reading_progress' AND column_name = 'position') AS supported`,
  )
  hasPositionColumn = row?.supported ?? false
  return hasPositionColumn
}

/**
 * Прогресс чтения пользователя по главе внутри издания.
 * ON CONFLICT использует тот же WHERE, что и частичный уникальный индекс.
 */
export async function upsertReadingProgress(params: {
  editionId: string
  chapterId: string
  userId: string
  progressPercent: number
  position?: ReadingPosition | null
}) {
  const clamped = Math.max(0, Math.min(100, params.progressPercent))
  const withPosition = await supportsPosition()
  // The partial unique index needs the same predicate in ON CONFLICT.
  return dbQueryOne<{ id: string }>(
    `INSERT INTO reading_progress (edition_id, chapter_id, user_id, progress_percent, last_read_at${withPosition ? ', position' : ''})
     VALUES ($1, $2, $3, $4, NOW()${withPosition ? ', $5::jsonb' : ''})
     ON CONFLICT (edition_id, chapter_id, user_id) WHERE user_id IS NOT NULL
     DO UPDATE SET progress_percent = EXCLUDED.progress_percent, last_read_at = NOW()${withPosition ? ', position = EXCLUDED.position' : ''}
     RETURNING id`,
    [params.editionId, params.chapterId, params.userId, clamped, ...(withPosition ? [JSON.stringify(params.position ?? null)] : [])],
  )
}

/** Последняя прочитанная позиция пользователя в издании (для resume-функционала). */
export async function fetchReadingProgress(editionId: string, userId: string) {
  return dbQueryOne<{ chapter_id: string; progress_percent: string; position: ReadingPosition | null; last_read_at: Date }>(
    `SELECT chapter_id, progress_percent, to_jsonb(rp)->'position' AS position, last_read_at
     FROM reading_progress rp
     WHERE edition_id = $1 AND user_id = $2
     ORDER BY last_read_at DESC
     LIMIT 1`,
    [editionId, userId],
  )
}

/**
 * Прогресс по всем главам издания — для отметок в оглавлении.
 * progress_percent приходит из NUMERIC строкой, поэтому приводим к числу здесь.
 */
export async function fetchEditionProgressMap(
  editionId: string,
  userId: string,
): Promise<Record<string, number>> {
  const rows = await dbQuery<{ chapter_id: string; progress_percent: string }>(
    `SELECT chapter_id, progress_percent
     FROM reading_progress
     WHERE edition_id = $1 AND user_id = $2`,
    [editionId, userId],
  )

  const map: Record<string, number> = {}
  for (const row of rows) {
    map[row.chapter_id] = Number(row.progress_percent)
  }
  return map
}
