import { dbQuery, dbQueryOne } from '@/lib/db'
import { NewsPost } from '@/lib/types'

const newsColumns = `id, section, title, content, tag, display_order, is_active, created_at, author_user_id, cover_image, status, published_at, updated_at`

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
  return dbQueryOne<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts WHERE id = $1 LIMIT 1`,
    [id],
  )
}

export async function createNewsPost(data: Record<string, unknown>) {
  return dbQueryOne<NewsPost>(
    `INSERT INTO news_posts (section, title, content, tag, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${newsColumns}`,
    [data.section, data.title, data.content, data.tag, data.display_order, data.is_active],
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
