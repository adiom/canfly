import { dbQuery, dbQueryOne } from '@/lib/db'
import type { ChapterHighlight, ChapterHighlightInput, ChapterEditorialNote, EditorialNoteStatus } from '@/lib/releases-types'

const highlightColumns = `
  h.id, h.chapter_id, h.user_id,
  h.text_content, h.paragraph_index,
  h.context_before, h.context_after,
  h.note, h.is_public, h.likes_count,
  h.created_at,
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
  const rows = await fetchChapterHighlights({ userId, limit })
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
  const row = await dbQueryOne<ChapterHighlight>(
    `INSERT INTO chapter_highlights (
       chapter_id, user_id, text_content,
       paragraph_index, context_before, context_after,
       note, is_public
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, chapter_id, user_id, text_content, paragraph_index,
       context_before, context_after, note, is_public, likes_count, created_at`,
    [
      data.chapter_id,
      userId,
      data.text_content,
      data.paragraph_index ?? null,
      data.context_before ?? null,
      data.context_after ?? null,
      data.note ?? null,
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
    params.push(data.note)
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

export async function toggleHighlightLike(highlightId: string, userId: string): Promise<{ liked: boolean; likes_count: number } | null> {
  const highlight = await dbQueryOne<{ id: string; user_id: string; is_public: boolean }>(
    `SELECT id, user_id, is_public FROM chapter_highlights WHERE id = $1 LIMIT 1`,
    [highlightId],
  )
  if (!highlight) return null
  if (!highlight.is_public && highlight.user_id !== userId) return null

  const existing = await dbQueryOne<{ highlight_id: string }>(
    `SELECT highlight_id FROM chapter_highlight_likes WHERE highlight_id = $1 AND user_id = $2 LIMIT 1`,
    [highlightId, userId],
  )

  if (existing) {
    await dbQuery(
      `DELETE FROM chapter_highlight_likes WHERE highlight_id = $1 AND user_id = $2`,
      [highlightId, userId],
    )
    await dbQuery(
      `UPDATE chapter_highlights SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1`,
      [highlightId],
    )
  } else {
    await dbQuery(
      `INSERT INTO chapter_highlight_likes (highlight_id, user_id) VALUES ($1, $2)`,
      [highlightId, userId],
    )
    await dbQuery(
      `UPDATE chapter_highlights SET likes_count = likes_count + 1 WHERE id = $1`,
      [highlightId],
    )
  }

  const updated = await dbQueryOne<{ likes_count: number }>(
    `SELECT likes_count FROM chapter_highlights WHERE id = $1`,
    [highlightId],
  )
  return { liked: !existing, likes_count: updated?.likes_count ?? 0 }
}

// === Editorial Notes (только Studio) ===

const editorialColumns = `
  n.id, n.chapter_id, n.author_id,
  n.text_content, n.paragraph_index,
  n.context_before, n.context_after,
  n.note, n.status,
  n.created_at, n.resolved_at,
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

export async function createEditorialNote(authorId: string, data: {
  chapter_id: string
  text_content: string
  paragraph_index?: number | null
  context_before?: string | null
  context_after?: string | null
  note: string
}): Promise<ChapterEditorialNote | null> {
  return dbQueryOne<ChapterEditorialNote>(
    `INSERT INTO chapter_editorial_notes (
       chapter_id, author_id, text_content,
       paragraph_index, context_before, context_after, note
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, chapter_id, author_id, text_content, paragraph_index,
       context_before, context_after, note, status, created_at, resolved_at`,
    [
      data.chapter_id,
      authorId,
      data.text_content,
      data.paragraph_index ?? null,
      data.context_before ?? null,
      data.context_after ?? null,
      data.note,
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

export async function deleteEditorialNote(id: string): Promise<void> {
  await dbQuery(`DELETE FROM chapter_editorial_notes WHERE id = $1`, [id])
}
