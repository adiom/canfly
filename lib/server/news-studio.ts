import { dbQuery, dbQueryOne } from '@/lib/db'
import { redirect } from 'next/navigation'
import { sanitizeChapterHtml } from '@/lib/sanitize'
import { generateSlug } from '@/lib/slug-utils'
import { generateUniqueNewsSlug } from '@/lib/server/news'
import type { NewsPost } from '@/lib/types'
import {
  requireStudioSession,
  type StudioSession,
} from '@/lib/server/studio-auth'

const newsColumns = `
  id, slug, section, title, content, tag, display_order, is_active,
  author_user_id, cover_image, status, published_at, created_at, updated_at
`

const DRAFT_TITLE = 'Без названия'
const MAX_SLUG_ATTEMPTS = 50

/**
 * Пустой черновик для хаба /studio/new. `slug` объявлен NOT NULL (миграция
 * 018_news_slug), поэтому свободный адрес подбирается сразу. `ON CONFLICT
 * DO NOTHING` вместо unique_violation: параллельные черновики с одинаковым
 * «Без названия» просто получают следующий суффикс.
 */
export async function createNewsDraft(userId: string): Promise<NewsPost> {
  const base = generateSlug(DRAFT_TITLE)

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const created = await dbQueryOne<NewsPost>(
      `INSERT INTO news_posts (title, section, content, status, author_user_id, slug)
       VALUES ($1, 'dispatch', '', 'draft', $2, $3)
       ON CONFLICT (slug) DO NOTHING
       RETURNING ${newsColumns}`,
      [DRAFT_TITLE, userId, candidate],
    )
    if (created) return created
  }

  throw new Error(`Не удалось подобрать slug черновика новости «${base}»`)
}

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
  if (session.isAdmin) {
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

  if (session.isAdmin) {
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
  const current = await dbQueryOne<{ title: string; status: string }>(
    'SELECT title, status FROM news_posts WHERE id = $1 LIMIT 1',
    [id],
  )
  if (!current) return null

  // Черновик публичного адреса ещё не имеет — slug едет за заголовком.
  // У опубликованной новости slug заморожен: ссылка уже могла уйти наружу.
  const slug =
    current.status === 'draft' && current.title !== data.title
      ? await generateUniqueNewsSlug(data.title, id)
      : null

  return dbQueryOne<NewsPost>(
    `UPDATE news_posts
     SET title = $2, section = $3, tag = $4, content = $5, cover_image = $6,
         slug = COALESCE($7, slug),
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${newsColumns}`,
    [
      id,
      data.title,
      data.section,
      data.tag,
      sanitizeChapterHtml(data.content),
      data.cover_image,
      slug,
    ],
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
