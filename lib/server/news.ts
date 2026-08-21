import { dbQuery, dbQueryOne } from '@/lib/db'
import { sanitizeChapterHtml } from '@/lib/sanitize'
import { generateSlug } from '@/lib/slug-utils'
import { NewsPost } from '@/lib/types'

const newsColumns = `id, slug, section, title, content, tag, display_order, is_active, created_at, author_user_id, cover_image, status, published_at, updated_at`

/** Контент новости пишет любой author — доверенным он не является */
function withSafeContent<T extends { content?: string | null }>(row: T): T {
  if (!row.content) return row
  return { ...row, content: sanitizeChapterHtml(row.content) }
}

export async function fetchNewsPosts(limit = 3) {
  return dbQuery<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts
     WHERE status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [limit],
  )
}

export async function listAdminNewsPosts() {
  return dbQuery<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts ORDER BY updated_at DESC`,
  )
}

export async function fetchNewsPostById(id: string) {
  const row = await dbQueryOne<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts WHERE id = $1 LIMIT 1`,
    [id],
  )
  return row ? withSafeContent(row) : row
}

export async function fetchNewsPostBySlug(slug: string) {
  const row = await dbQueryOne<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return row ? withSafeContent(row) : row
}

/** Генерирует уникальный slug из title, проверяя коллизии в БД */
async function generateUniqueNewsSlug(title: string): Promise<string> {
  const base = generateSlug(title)
  const existing = await dbQuery<{ slug: string }>(
    'SELECT slug FROM news_posts WHERE slug = $1 OR slug LIKE $2',
    [base, `${base}-%`],
  )
  const slugs = existing.map(r => r.slug)
  if (slugs.length === 0) return base

  let counter = 2
  while (slugs.includes(`${base}-${counter}`)) counter++
  return `${base}-${counter}`
}

export async function createNewsPost(data: Record<string, unknown>) {
  const slug = await generateUniqueNewsSlug((data.title as string) || 'untitled')
  return dbQueryOne<NewsPost>(
    `INSERT INTO news_posts (section, title, slug, content, tag, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${newsColumns}`,
    [data.section, data.title, slug, data.content, data.tag, data.display_order, data.is_active],
  )
}

export async function updateNewsPost(id: string, data: Record<string, unknown>) {
  return dbQueryOne<NewsPost>(
    `UPDATE news_posts
     SET section = $2, title = $3, content = $4, tag = $5, display_order = $6, is_active = $7
     WHERE id = $1
     RETURNING ${newsColumns}`,
    [id, data.section, data.title, data.content, data.tag, data.display_order, data.is_active],
  )
}

export async function deleteNewsPost(id: string) {
  await dbQuery('DELETE FROM news_posts WHERE id = $1', [id])
}
