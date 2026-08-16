import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import { sanitizePlainText } from '@/lib/sanitize'
import type { ChapterHighlight, ChapterHighlightInput, ChapterEditorialNote, EditorialNoteStatus } from '@/lib/releases-types'

const highlightColumns = `
  h.id, h.chapter_id, h.user_id,
  h.text_content, h.paragraph_index,
  h.context_before, h.context_after,
  h.client_request_id, h.start_offset, h.end_offset,
  h.source_chapter_updated_at,
  h.note, h.is_public, h.likes_count,
  h.created_at, h.updated_at, h.ai_artifacts,
  u.display_name AS user_name,
  u.avatar AS user_avatar
`

// === Chapter Highlights ===

export interface FetchHighlightsOptions {
  chapterId?: string
  userId?: string
  publicOnly?: boolean
  currentUserId?: string | null
  limit?: number
}

export async function fetchChapterHighlights(options: FetchHighlightsOptions): Promise<ChapterHighlight[]> {
  const params: unknown[] = []
  const where: string[] = []

  if (options.chapterId) {
    params.push(options.chapterId)
    where.push(`h.chapter_id = $${params.length}`)
  }

  if (options.userId) {
    params.push(options.userId)
    where.push(`h.user_id = $${params.length}`)
  }

  // Фильтр видимости безусловный. Раньше он стоял в ветке if/else и не
  // срабатывал для анонима (currentUserId = null) и при запросе ?userId=,
  // из-за чего публичный GET /api/chapter-highlights отдавал приватные
  // цитаты и заметки всех пользователей.
  if (options.publicOnly || !options.currentUserId) {
    where.push(`h.is_public = true`)
  } else {
    // Публичные + собственные приватные
    params.push(options.currentUserId)
    where.push(`(h.is_public = true OR h.user_id = $${params.length})`)
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const limitClause = options.limit ? `LIMIT ${Math.max(1, Math.min(200, options.limit))}` : ''

  const rows = await dbQuery<ChapterHighlight>(
    `SELECT ${highlightColumns}
     FROM chapter_highlights h
     LEFT JOIN users u ON u.id = h.user_id
     ${whereClause}
     ORDER BY h.created_at DESC
     ${limitClause}`,
    params,
  )

  // Дополнительно загружаем лайки текущего пользователя
  if (options.currentUserId && rows.length > 0) {
    const ids = rows.map(r => r.id)
    const likeRows = await dbQuery<{ highlight_id: string }>(
      `SELECT highlight_id FROM chapter_highlight_likes
       WHERE user_id = $1 AND highlight_id = ANY($2::uuid[])`,
      [options.currentUserId, ids],
    )
    const likedSet = new Set(likeRows.map(r => r.highlight_id))
    return rows.map(r => ({ ...r, is_liked_by_me: likedSet.has(r.id) }))
  }

  return rows.map(r => ({ ...r, is_liked_by_me: false }))
}

export async function fetchPublicHighlightsByRelease(releaseId: string, limit = 6): Promise<ChapterHighlight[]> {
  const safeLimit = Math.max(1, Math.min(50, limit))
  const rows = await dbQuery<ChapterHighlight>(
    `SELECT ${highlightColumns},
            r.slug AS release_slug,
            ch.title AS chapter_title
     FROM chapter_highlights h
     LEFT JOIN users u ON u.id = h.user_id
     JOIN chapters ch ON ch.id = h.chapter_id
     JOIN editions e ON e.id = ch.edition_id
     JOIN releases r ON r.id = e.release_id
     WHERE e.release_id = $1 AND h.is_public = true
     ORDER BY h.likes_count DESC, h.created_at DESC
     LIMIT ${safeLimit}`,
    [releaseId],
  )
  return rows.map(r => ({ ...r, is_liked_by_me: false }))
}

export async function fetchChapterHighlightById(id: string, currentUserId: string | null): Promise<ChapterHighlight | null> {
  const row = await dbQueryOne<ChapterHighlight>(
    `SELECT ${highlightColumns}
     FROM chapter_highlights h
     LEFT JOIN users u ON u.id = h.user_id
     WHERE h.id = $1 LIMIT 1`,
    [id],
  )
  if (!row) return null
  // Приватная цитата видна только владельцу
  if (!row.is_public && row.user_id !== currentUserId) return null
  return { ...row, is_liked_by_me: false }
}

export async function fetchUserHighlights(userId: string, limit = 100): Promise<ChapterHighlight[]> {
  const rows = await fetchChapterHighlights({ userId, currentUserId: userId, limit })
  if (rows.length === 0) return rows

  // Подгружаем release_slug для каждой главы одним запросом
  const chapterIds = Array.from(new Set(rows.map(r => r.chapter_id)))
  const chapterInfo = await dbQuery<{ id: string; release_slug: string; title: string }>(
    `SELECT ch.id, r.slug AS release_slug, ch.title
     FROM chapters ch
     JOIN editions e ON e.id = ch.edition_id
     JOIN releases r ON r.id = e.release_id
     WHERE ch.id = ANY($1::uuid[])`,
    [chapterIds],
  )
  const infoMap = new Map(chapterInfo.map(c => [c.id, c]))

  return rows.map(r => {
    const info = infoMap.get(r.chapter_id)
    return {
      ...r,
      release_slug: info?.release_slug ?? null,
      chapter_title: info?.title ?? null,
    } as ChapterHighlight & { release_slug: string | null; chapter_title: string | null }
  })
}

export async function createChapterHighlight(userId: string, data: ChapterHighlightInput): Promise<ChapterHighlight | null> {
  const textContent = sanitizePlainText(data.text_content)
  const note = data.note == null ? null : sanitizePlainText(data.note)
  const contextBefore = data.context_before == null ? null : sanitizePlainText(data.context_before)
  const contextAfter = data.context_after == null ? null : sanitizePlainText(data.context_after)
  const row = await dbQueryOne<ChapterHighlight>(
    `INSERT INTO chapter_highlights (
       chapter_id, user_id, text_content,
       paragraph_index, context_before, context_after,
       client_request_id, start_offset, end_offset, source_chapter_updated_at,
       note, is_public
     )
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, ch.updated_at, $10, $11
     FROM chapters ch WHERE ch.id = $1
     ON CONFLICT (user_id, client_request_id) WHERE client_request_id IS NOT NULL
     DO UPDATE SET client_request_id = EXCLUDED.client_request_id
     RETURNING id, chapter_id, user_id, text_content, paragraph_index,
       context_before, context_after, client_request_id, start_offset, end_offset,
       source_chapter_updated_at, note, is_public, likes_count, created_at, updated_at`,
    [
      data.chapter_id,
      userId,
      textContent,
      data.paragraph_index ?? null,
      contextBefore,
      contextAfter,
      data.client_request_id ?? null,
      data.start_offset ?? null,
      data.end_offset ?? null,
      note,
      data.is_public,
    ],
  )
  if (!row) return null
  return fetchChapterHighlightById(row.id, userId)
}

export async function updateChapterHighlight(id: string, userId: string, isAdmin: boolean, data: { note?: string | null; is_public?: boolean }): Promise<ChapterHighlight | null> {
  const existing = await dbQueryOne<{ user_id: string }>(
    `SELECT user_id FROM chapter_highlights WHERE id = $1 LIMIT 1`,
    [id],
  )
  if (!existing) return null
  if (existing.user_id !== userId && !isAdmin) return null

  const fields: string[] = []
  const params: unknown[] = [id]

  if (data.note !== undefined) {
    params.push(data.note == null ? null : sanitizePlainText(data.note))
    fields.push(`note = $${params.length}`)
  }
  if (data.is_public !== undefined) {
    params.push(data.is_public)
    fields.push(`is_public = $${params.length}`)
  }
  if (fields.length === 0) return fetchChapterHighlightById(id, userId)

  await dbQuery(`UPDATE chapter_highlights SET ${fields.join(', ')} WHERE id = $1`, params)
  return fetchChapterHighlightById(id, userId)
}

export async function deleteChapterHighlight(id: string, userId: string, isAdmin: boolean): Promise<boolean> {
  const existing = await dbQueryOne<{ user_id: string }>(
    `SELECT user_id FROM chapter_highlights WHERE id = $1 LIMIT 1`,
    [id],
  )
  if (!existing) return false
  if (existing.user_id !== userId && !isAdmin) return false
  await dbQuery(`DELETE FROM chapter_highlights WHERE id = $1`, [id])
  return true
}

// === Likes ===

export async function setHighlightLike(highlightId: string, userId: string, liked?: boolean): Promise<{ liked: boolean; likes_count: number } | null> {
  return withTransaction(async client => {
    const highlightResult = await client.query<{ user_id: string; is_public: boolean }>(
      `SELECT user_id, is_public FROM chapter_highlights WHERE id = $1 FOR UPDATE`,
      [highlightId],
    )
    const highlight = highlightResult.rows[0]
    if (!highlight || (!highlight.is_public && highlight.user_id !== userId)) return null

    const existing = await client.query(
      `SELECT 1 FROM chapter_highlight_likes WHERE highlight_id = $1 AND user_id = $2`,
      [highlightId, userId],
    )
    const nextLiked = liked ?? existing.rowCount === 0
    if (nextLiked) {
      await client.query(
        `INSERT INTO chapter_highlight_likes (highlight_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [highlightId, userId],
      )
    } else {
      await client.query(
        `DELETE FROM chapter_highlight_likes WHERE highlight_id = $1 AND user_id = $2`,
        [highlightId, userId],
      )
    }
    const count = await client.query<{ likes_count: number }>(
      `UPDATE chapter_highlights h SET likes_count = (
         SELECT COUNT(*)::integer FROM chapter_highlight_likes l WHERE l.highlight_id = h.id
       ) WHERE h.id = $1 RETURNING likes_count`,
      [highlightId],
    )
    return { liked: nextLiked, likes_count: count.rows[0]?.likes_count ?? 0 }
  })
}

export async function toggleHighlightLike(highlightId: string, userId: string) {
  return setHighlightLike(highlightId, userId)
}

// === AI-артефакты (Объясни / Смысл / Перепиши / Нарисуй) ===

/**
 * Сохраняет результат AI-инструмента внутри `ai_artifacts` цитаты. `path` —
 * `['explain']` / `['meaning']` / `['illustrate']` или `['rewrite', mode]`.
 * Владение проверяется прямо в WHERE: если цитата чужая или уже удалена,
 * запрос молча ничего не обновит — это не должно ронять ответ пользователю,
 * который уже получил сгенерированный текст/картинку в стриме.
 */
export async function saveHighlightAiArtifact(
  highlightId: string,
  userId: string,
  path: string[],
  value: Record<string, unknown>,
): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    `UPDATE chapter_highlights
     SET ai_artifacts = jsonb_set(ai_artifacts, $2::text[], $3::jsonb, true)
     WHERE id = $1 AND user_id = $4
     RETURNING id`,
    [highlightId, path, JSON.stringify(value), userId],
  )
  return rows.length > 0
}

// === Editorial Notes (только Studio) ===

const editorialColumns = `
  n.id, n.chapter_id, n.author_id,
  n.text_content, n.paragraph_index,
  n.context_before, n.context_after,
  n.client_request_id, n.start_offset, n.end_offset,
  n.source_chapter_updated_at,
  n.note, n.status,
  n.created_at, n.resolved_at, n.updated_at,
  u.display_name AS author_name,
  u.avatar AS author_avatar
`

export async function fetchChapterEditorialNotes(chapterId: string): Promise<ChapterEditorialNote[]> {
  return dbQuery<ChapterEditorialNote>(
    `SELECT ${editorialColumns}
     FROM chapter_editorial_notes n
     LEFT JOIN users u ON u.id = n.author_id
     WHERE n.chapter_id = $1
     ORDER BY n.created_at DESC`,
    [chapterId],
  )
}

export async function canManageChapterEditorialNotes(
  chapterId: string,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true
  const row = await dbQueryOne<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM chapters ch
       JOIN editions e ON e.id = ch.edition_id
       JOIN release_collaborators rc ON rc.release_id = e.release_id
       WHERE ch.id = $1 AND rc.user_id = $2 AND rc.role = 'owner'
     ) AS allowed`,
    [chapterId, userId],
  )
  return row?.allowed ?? false
}

export async function fetchEditorialNoteChapterId(id: string): Promise<string | null> {
  const row = await dbQueryOne<{ chapter_id: string }>(
    `SELECT chapter_id FROM chapter_editorial_notes WHERE id = $1`,
    [id],
  )
  return row?.chapter_id ?? null
}

export async function createEditorialNote(authorId: string, data: {
  chapter_id: string
  text_content: string
  paragraph_index?: number | null
  context_before?: string | null
  context_after?: string | null
  client_request_id?: string
  start_offset?: number | null
  end_offset?: number | null
  note: string
}): Promise<ChapterEditorialNote | null> {
  return dbQueryOne<ChapterEditorialNote>(
    `WITH inserted AS (
       INSERT INTO chapter_editorial_notes (
         chapter_id, author_id, text_content,
       paragraph_index, context_before, context_after,
       client_request_id, start_offset, end_offset, source_chapter_updated_at, note
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, ch.updated_at, $10
       FROM chapters ch WHERE ch.id = $1
       ON CONFLICT (author_id, client_request_id) WHERE client_request_id IS NOT NULL
       DO UPDATE SET client_request_id = EXCLUDED.client_request_id
       RETURNING *
     )
     SELECT ${editorialColumns}
     FROM inserted n
     LEFT JOIN users u ON u.id = n.author_id`,
    [
      data.chapter_id,
      authorId,
      sanitizePlainText(data.text_content),
      data.paragraph_index ?? null,
      data.context_before == null ? null : sanitizePlainText(data.context_before),
      data.context_after == null ? null : sanitizePlainText(data.context_after),
      data.client_request_id ?? null,
      data.start_offset ?? null,
      data.end_offset ?? null,
      sanitizePlainText(data.note),
    ],
  )
}

export async function updateEditorialNoteStatus(id: string, status: EditorialNoteStatus): Promise<ChapterEditorialNote | null> {
  return dbQueryOne<ChapterEditorialNote>(
    `UPDATE chapter_editorial_notes
     SET status = $2,
         resolved_at = CASE WHEN $2 IN ('resolved', 'ignored') THEN NOW() ELSE NULL END
     WHERE id = $1
     RETURNING id, chapter_id, author_id, text_content, paragraph_index,
       context_before, context_after, note, status, created_at, resolved_at`,
    [id, status],
  )
}

/**
 * Удаляет замечание. Разрешено автору замечания и админу.
 * Возвращает `false`, если записи нет или прав недостаточно.
 */
export async function deleteEditorialNote(
  id: string,
  _userId: string,
  _isAdmin: boolean,
): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    `DELETE FROM chapter_editorial_notes WHERE id = $1 RETURNING id`,
    [id],
  )
  return rows.length > 0
}
