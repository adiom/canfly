import { dbQueryOne } from '@/lib/db'

/**
 * Прогресс чтения пользователя по главе внутри издания.
 * Условный уникальный индекс (WHERE user_id IS NOT NULL) не поддерживает
 * ON CONFLICT напрямую. Поэтому используем явный UPDATE + INSERT.
 */
export async function upsertReadingProgress(params: {
  editionId: string
  chapterId: string
  userId: string
  progressPercent: number
}) {
  const clamped = Math.max(0, Math.min(100, params.progressPercent))

  // Сначала пробуем UPDATE
  const updateResult = await dbQueryOne<{ id: string }>(
    `UPDATE reading_progress
     SET progress_percent = $1, last_read_at = NOW()
     WHERE edition_id = $2 AND chapter_id = $3 AND user_id = $4
     RETURNING id`,
    [clamped, params.editionId, params.chapterId, params.userId],
  )

  // Если UPDATE ничего не обновил, INSERT новую запись
  if (updateResult) return updateResult

  return dbQueryOne<{ id: string }>(
    `INSERT INTO reading_progress (edition_id, chapter_id, user_id, progress_percent, last_read_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [params.editionId, params.chapterId, params.userId, clamped],
  )
}

/** Последняя прочитанная позиция пользователя в издании (для resume-функционала). */
export async function fetchReadingProgress(editionId: string, userId: string) {
  return dbQueryOne<{ chapter_id: string; progress_percent: string }>(
    `SELECT chapter_id, progress_percent
     FROM reading_progress
     WHERE edition_id = $1 AND user_id = $2
     ORDER BY last_read_at DESC
     LIMIT 1`,
    [editionId, userId],
  )
}
