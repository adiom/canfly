import type { PoolClient } from 'pg'
import { dbQuery, dbQueryOne, dbUpdatePartial, withTransaction } from '@/lib/db'
import type { UpdatableColumn } from '@/lib/db'
import { sanitizeChapterHtml } from '@/lib/sanitize'
import type { Chapter, ChapterVersion } from '@/lib/releases-types'
import { ChapterWriteError } from '@/lib/studio/chapter-write'

/**
 * Контент чистится здесь, в серверном слое, а не в ридерах: ридеры клиентские,
 * и санитайзер в них — это и лишний вес бандла, и защита не там, где нужно.
 * Чистим на чтении, чтобы покрыть и уже сохранённые главы.
 */
function withSafeContent<T extends { content?: string | null }>(row: T): T {
  if (!row.content) return row
  return { ...row, content: sanitizeChapterHtml(row.content) }
}

/** Пишем в БД уже очищенный HTML: Studio и MCP идут через один слой. */
function safeContent(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return sanitizeChapterHtml(typeof value === 'string' ? value : String(value))
}

function countChapterWords(html: string | null | undefined): number {
  if (!html) return 0
  return html
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

const chapterColumns = `
  id, revision, edition_id, title, content, audio_url, audio_blob_path, duration_seconds,
  audio_metadata, audio_content_type, audio_file_size_bytes, audio_uploaded_at, chapter_index,
  status, word_count, view_count,
  created_at, updated_at, published_at
`

const chapterListColumns = `
  id, revision, edition_id, title, audio_url, audio_blob_path, duration_seconds,
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

/** Все главы, включая черновики. Вызывающий код обязан проверить приватный доступ. */
export async function fetchAllChaptersByEdition(editionId: string) {
  const rows = await dbQuery<Chapter>(
    `SELECT ${chapterColumns} FROM chapters
     WHERE edition_id = $1
     ORDER BY chapter_index ASC, id ASC`,
    [editionId],
  )
  return rows.map(withSafeContent)
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

/**
 * Список опубликованных глав без `content` — для оглавления издания.
 * Отдельно от fetchPublishedChaptersByEdition: та тянет текст всех глав
 * и прогоняет каждую через санитайзер, что для списка лишняя работа.
 */
export async function fetchPublishedChapterListByEdition(editionId: string) {
  return dbQuery<Omit<Chapter, 'content'>>(
    `SELECT ${chapterListColumns} FROM chapters
     WHERE edition_id = $1 AND status = 'published'
     ORDER BY chapter_index ASC`,
    [editionId],
  )
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

/**
 * Соседи главы по порядку `chapter_index` — для кнопок «предыдущая/следующая»
 * в редакторе. Ориентир — индекс, а не `created_at`: порядок глав задаётся
 * вручную в Studio. Одно окно закрывает обе стороны сразу, `id` в сортировке
 * нужен как детерминированный тайбрейкер при совпадающих индексах.
 */
export async function fetchChapterNeighbors(editionId: string, chapterId: string) {
  return dbQueryOne<{
    prev_id: string | null
    prev_title: string | null
    next_id: string | null
    next_title: string | null
  }>(
    `SELECT prev_id, prev_title, next_id, next_title
     FROM (
       SELECT id, title,
         LAG(id) OVER w AS prev_id,
         LAG(title) OVER w AS prev_title,
         LEAD(id) OVER w AS next_id,
         LEAD(title) OVER w AS next_title
       FROM chapters
       WHERE edition_id = $1
       WINDOW w AS (ORDER BY chapter_index ASC, id ASC)
     ) neighbors
     WHERE id = $2`,
    [editionId, chapterId],
  )
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
      safeContent(data.content),
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

/**
 * Колонки, которые разрешено менять через updateChapter. Ключ отсутствует в
 * data — колонка не участвует в UPDATE.
 */
const chapterUpdatable: Record<string, UpdatableColumn> = {
  title: { column: 'title' },
  content: { column: 'content' },
  audio_url: { column: 'audio_url' },
  audio_blob_path: { column: 'audio_blob_path' },
  duration_seconds: { column: 'duration_seconds' },
  audio_metadata: {
    column: 'audio_metadata',
    cast: '::jsonb',
    serialize: (value) => JSON.stringify(value ?? {}),
  },
  audio_content_type: { column: 'audio_content_type' },
  audio_file_size_bytes: { column: 'audio_file_size_bytes' },
  audio_uploaded_at: { column: 'audio_uploaded_at' },
  chapter_index: { column: 'chapter_index' },
  status: { column: 'status', cast: '::chapter_status' },
  word_count: { column: 'word_count' },
}

function updateChapterFields(id: string, data: Record<string, unknown>, client?: PoolClient) {
  return dbUpdatePartial<Chapter>({
    table: 'chapters',
    id,
    data,
    columns: chapterUpdatable,
    returning: chapterColumns,
    client,
  })
}

async function lockChapterContent(client: PoolClient, id: string, expectedRevision?: number) {
  const { rows: [current] } = await client.query<Pick<Chapter, 'content' | 'revision'>>(
    'SELECT content, revision FROM chapters WHERE id = $1 FOR UPDATE',
    [id],
  )
  if (expectedRevision !== undefined) {
    if (!current) throw new ChapterWriteError('not-found')
    if (current.revision !== expectedRevision) throw new ChapterWriteError('conflict')
  }
  return current ?? null
}

/** Вызывается только после блокировки главы на том же клиенте. */
async function updateLockedChapter(
  client: PoolClient,
  id: string,
  currentContent: string | null,
  data: Record<string, unknown>,
  content: string | null,
  archiveEmptyContent = false,
) {
  const previous = sanitizeChapterHtml(currentContent)
  if ((previous || archiveEmptyContent) && previous !== (content ?? '')) {
    await client.query(
      `INSERT INTO chapter_versions (chapter_id, content, version_number)
       SELECT $1, $2, COALESCE(MAX(version_number), 0) + 1
       FROM chapter_versions WHERE chapter_id = $1`,
      [id, previous],
    )
  }

  const updated = await updateChapterFields(id, {
    ...data,
    content,
    word_count: data.word_count ?? countChapterWords(content),
  }, client)
  if (!updated) throw new Error('Не удалось обновить заблокированную главу')
  return updated
}

/** Перезаписывает только переданные поля и архивирует заменяемое содержимое. */
export async function updateChapter(
  id: string,
  data: Record<string, unknown>,
  { archiveEmptyContent = false, expectedRevision }: {
    archiveEmptyContent?: boolean
    expectedRevision?: number
  } = {},
) {
  if (data.content === undefined && expectedRevision === undefined) {
    const chapter = await updateChapterFields(id, data)
    return chapter ? withSafeContent(chapter) : null
  }

  return withTransaction(async (client) => {
    const current = await lockChapterContent(client, id, expectedRevision)
    if (!current) return null
    if (data.content === undefined) {
      const chapter = await updateChapterFields(id, data, client)
      if (!chapter) throw new ChapterWriteError('not-found')
      return withSafeContent(chapter)
    }
    return updateLockedChapter(client, id, current.content, data, safeContent(data.content), archiveEmptyContent)
  })
}

export async function reorderChapters(editionId: string, chapterIds: string[]) {
  if (chapterIds.length === 0) return

  const rows = await dbQuery<{ id: string }>(
    `SELECT id FROM chapters WHERE edition_id = $1`,
    [editionId],
  )

  const existingIds = new Set(rows.map(row => row.id))
  const uniqueIds = new Set(chapterIds)
  if (
    rows.length !== chapterIds.length ||
    uniqueIds.size !== chapterIds.length ||
    chapterIds.some(id => !existingIds.has(id))
  ) {
    throw new Error('Неверный порядок глав')
  }

  await withTransaction(async (client) => {
    for (let i = 0; i < chapterIds.length; i++) {
      await client.query(
        `UPDATE chapters SET chapter_index = $1 WHERE id = $2 AND edition_id = $3`,
        [i + 1, chapterIds[i], editionId],
      )
    }
  })
}

export async function publishChapter(id: string, expectedRevision?: number) {
  const sql = `UPDATE chapters SET status = 'published', published_at = COALESCE(published_at, NOW())
     WHERE id = $1 RETURNING ${chapterColumns}`
  if (expectedRevision === undefined) return dbQueryOne<Chapter>(sql, [id])
  return withTransaction(async (client) => {
    await lockChapterContent(client, id, expectedRevision)
    const { rows: [chapter] } = await client.query<Chapter>(sql, [id])
    return chapter ?? null
  })
}

export async function deleteChapter(id: string, expectedRevision: number) {
  await withTransaction(async (client) => {
    await lockChapterContent(client, id, expectedRevision)
    await client.query('DELETE FROM chapters WHERE id = $1', [id])
  })
}

export async function incrementChapterViews(id: string) {
  await dbQuery('UPDATE chapters SET view_count = view_count + 1 WHERE id = $1', [id])
}

// --- Chapter Versions ---

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

/**
 * Откат к версии. Перед перезаписью сохраняем именно текущий текст главы, а не
 * выбранную версию: иначе откат уничтожал бы последнюю редакцию без следа.
 * Обе операции — в одной транзакции, чтобы параллельное сохранение не вклинилось
 * между снимком и обновлением.
 */
export async function restoreChapterVersion(chapterId: string, versionId: string, expectedRevision?: number) {
  return withTransaction(async (client) => {
    const current = await lockChapterContent(client, chapterId, expectedRevision)
    if (!current) return null

    const { rows } = await client.query<{ content: string }>(
      'SELECT content FROM chapter_versions WHERE id = $1 AND chapter_id = $2',
      [versionId, chapterId],
    )
    const version = rows[0]
    if (!version) return null

    return updateLockedChapter(client, chapterId, current.content, {}, sanitizeChapterHtml(version.content))
  })
}
