import { dbQuery, dbQueryOne } from '@/lib/db'
import { sanitizeChapterHtml } from '@/lib/sanitize'
import type { Chapter, ChapterVersion } from '@/lib/releases-types'

/**
 * Контент чистится здесь, в серверном слое, а не в ридерах: ридеры клиентские,
 * и санитайзер в них — это и лишний вес бандла, и защита не там, где нужно.
 * Чистим на чтении, чтобы покрыть и уже сохранённые главы.
 */
function withSafeContent<T extends { content?: string | null }>(row: T): T {
  if (!row.content) return row
  return { ...row, content: sanitizeChapterHtml(row.content) }
}

const chapterColumns = `
  id, edition_id, title, content, audio_url, audio_blob_path, duration_seconds,
  audio_metadata, audio_content_type, audio_file_size_bytes, audio_uploaded_at, chapter_index,
  status, word_count, view_count,
  created_at, updated_at, published_at
`

const chapterListColumns = `
  id, edition_id, title, audio_url, audio_blob_path, duration_seconds,
  audio_metadata, audio_content_type, audio_file_size_bytes, audio_uploaded_at, chapter_index,
  status, word_count, view_count,
  created_at, updated_at, published_at
`

export async function fetchChaptersByEdition(editionId: string) {
  return dbQuery<Chapter>(
    `SELECT ${chapterListColumns} FROM chapters
     WHERE edition_id = $1
     ORDER BY chapter_index ASC`,
    [editionId],
  )
}

export async function fetchPublishedChaptersByEdition(editionId: string) {
  const rows = await dbQuery<Chapter>(
    `SELECT ${chapterColumns} FROM chapters
     WHERE edition_id = $1 AND status = 'published'
     ORDER BY chapter_index ASC`,
    [editionId],
  )
  return rows.map(withSafeContent)
}

export async function fetchChapterById(id: string) {
  const row = await dbQueryOne<Chapter>(
    `SELECT ${chapterColumns} FROM chapters WHERE id = $1 LIMIT 1`,
    [id],
  )
  return row ? withSafeContent(row) : row
}

export async function fetchChapterByEditionAndIndex(editionId: string, chapterIndex: number) {
  const row = await dbQueryOne<Chapter>(
    `SELECT ${chapterColumns} FROM chapters
     WHERE edition_id = $1 AND chapter_index = $2 LIMIT 1`,
    [editionId, chapterIndex],
  )
  return row ? withSafeContent(row) : row
}

export async function createChapter(data: Record<string, unknown>) {
  return dbQueryOne<Chapter>(
    `INSERT INTO chapters (
       edition_id, title, content, audio_url, audio_blob_path, duration_seconds,
       audio_metadata, audio_content_type, audio_file_size_bytes, audio_uploaded_at,
       chapter_index, status, word_count
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::chapter_status, $13)
     RETURNING ${chapterColumns}`,
    [
      data.edition_id,
      data.title,
      data.content ?? null,
      data.audio_url ?? null,
      data.audio_blob_path ?? null,
      data.duration_seconds ?? null,
      JSON.stringify(data.audio_metadata ?? {}),
      data.audio_content_type ?? null,
      data.audio_file_size_bytes ?? null,
      data.audio_uploaded_at ?? null,
      data.chapter_index,
      data.status ?? 'draft',
      data.word_count ?? 0,
    ],
  )
}

export async function updateChapter(id: string, data: Record<string, unknown>) {
  return dbQueryOne<Chapter>(
    `UPDATE chapters SET
      title = $2, content = $3, audio_url = $4, audio_blob_path = $5,
      duration_seconds = $6, audio_metadata = $7::jsonb, audio_content_type = $8,
      audio_file_size_bytes = $9, audio_uploaded_at = $10,
      chapter_index = $11, status = $12::chapter_status, word_count = $13
     WHERE id = $1
     RETURNING ${chapterColumns}`,
    [
      id,
      data.title,
      data.content ?? null,
      data.audio_url ?? null,
      data.audio_blob_path ?? null,
      data.duration_seconds ?? null,
      JSON.stringify(data.audio_metadata ?? {}),
      data.audio_content_type ?? null,
      data.audio_file_size_bytes ?? null,
      data.audio_uploaded_at ?? null,
      data.chapter_index,
      data.status ?? 'draft',
      data.word_count ?? 0,
    ],
  )
}

export async function publishChapter(id: string) {
  return dbQueryOne<Chapter>(
    `UPDATE chapters SET status = 'published', published_at = COALESCE(published_at, NOW())
     WHERE id = $1
     RETURNING ${chapterColumns}`,
    [id],
  )
}

export async function deleteChapter(id: string) {
  await dbQuery('DELETE FROM chapters WHERE id = $1', [id])
}

export async function incrementChapterViews(id: string) {
  await dbQuery('UPDATE chapters SET view_count = view_count + 1 WHERE id = $1', [id])
}

// --- Chapter Versions ---

export async function createChapterVersion(chapterId: string, content: string) {
  const last = await dbQueryOne<{ version_number: number }>(
    `SELECT version_number FROM chapter_versions
     WHERE chapter_id = $1 ORDER BY version_number DESC LIMIT 1`,
    [chapterId],
  )
  const nextVersion = (last?.version_number ?? 0) + 1

  return dbQueryOne<ChapterVersion>(
    `INSERT INTO chapter_versions (chapter_id, content, version_number)
     VALUES ($1, $2, $3)
     RETURNING id, chapter_id, content, version_number, created_at`,
    [chapterId, content, nextVersion],
  )
}

export async function fetchChapterVersions(chapterId: string) {
  return dbQuery<ChapterVersion>(
    `SELECT id, chapter_id, content, version_number, created_at
     FROM chapter_versions
     WHERE chapter_id = $1
     ORDER BY version_number DESC`,
    [chapterId],
  )
}

export async function fetchChapterVersion(versionId: string) {
  return dbQueryOne<ChapterVersion>(
    `SELECT id, chapter_id, content, version_number, created_at
     FROM chapter_versions WHERE id = $1 LIMIT 1`,
    [versionId],
  )
}

export async function restoreChapterVersion(chapterId: string, versionId: string) {
  const version = await fetchChapterVersion(versionId)
  if (!version || version.chapter_id !== chapterId) return null

  await createChapterVersion(chapterId, version.content)

  return dbQueryOne<Chapter>(
    `UPDATE chapters SET content = $2, word_count = $3
     WHERE id = $1
     RETURNING ${chapterColumns}`,
    [chapterId, version.content, version.content.split(/\s+/).filter(Boolean).length],
  )
}
