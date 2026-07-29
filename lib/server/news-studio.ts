import { dbQuery, dbQueryOne } from '@/lib/db'
import { redirect } from 'next/navigation'
import { sanitizeChapterHtml } from '@/lib/sanitize'
import type { NewsPost } from '@/lib/types'
import {
  requireStudioSession,
  type StudioSession,
} from '@/lib/server/studio-auth'

const newsColumns = `
  id, section, title, content, tag, display_order, is_active,
  author_user_id, cover_image, status, published_at, created_at, updated_at
`

export async function listNewsByAuthor(userId: string): Promise<NewsPost[]> {
  return dbQuery<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts
     WHERE author_user_id = $1
     ORDER BY updated_at DESC`,
    [userId],
  )
}

export async function listAllNews(): Promise<NewsPost[]> {
  return dbQuery<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts ORDER BY updated_at DESC`,
  )
}

export async function listMyNews(session: StudioSession): Promise<NewsPost[]> {
  if (session.roles.includes('admin')) {
    return listAllNews()
  }
  return listNewsByAuthor(session.user.id)
}

export async function fetchNewsForEdit(id: string): Promise<NewsPost | null> {
  return dbQueryOne<NewsPost>(
    `SELECT ${newsColumns} FROM news_posts WHERE id = $1 LIMIT 1`,
    [id],
  )
}

export interface NewsOwnership {
  session: StudioSession
  newsId: string
}

/**
 * Проверяет, что текущий пользователь — автор новости либо admin.
 * Бросает redirect('/studio/news') при отсутствии доступа.
 */
export async function requireNewsOwnership(newsId: string): Promise<NewsOwnership> {
  const session = await requireStudioSession()
  if (!session) redirect('/login')

  if (session.roles.includes('admin')) {
    return { session, newsId }
  }

  const link = await dbQueryOne<{ author_user_id: string | null }>(
    'SELECT author_user_id FROM news_posts WHERE id = $1 LIMIT 1',
    [newsId],
  )

  if (!link || link.author_user_id !== session.user.id) redirect('/studio/news')

  return { session, newsId }
}

export async function updateNews(
  id: string,
  data: {
    title: string
    section: string
    tag: string | null
    content: string | null
    cover_image: string | null
  },
): Promise<NewsPost | null> {
  return dbQueryOne<NewsPost>(
    `UPDATE news_posts
     SET title = $2, section = $3, tag = $4, content = $5, cover_image = $6,
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${newsColumns}`,
    [id, data.title, data.section, data.tag, sanitizeChapterHtml(data.content), data.cover_image],
  )
}

export async function updateNewsStatus(
  id: string,
  status: 'draft' | 'published' | 'archived',
): Promise<NewsPost | null> {
  return dbQueryOne<NewsPost>(
    `UPDATE news_posts
     SET status = $2,
         published_at = CASE
           WHEN $2 = 'published' AND published_at IS NULL THEN NOW()
           WHEN $2 = 'published' THEN published_at
           ELSE NULL
         END,
         is_active = ($2 = 'published'),
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${newsColumns}`,
    [id, status],
  )
}

export async function deleteNews(id: string): Promise<void> {
  await dbQuery('DELETE FROM news_posts WHERE id = $1', [id])
}
