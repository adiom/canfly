import { dbQuery, dbQueryOne } from '@/lib/db'
import type { NewsPost } from '@/lib/types'
import type { Release, EditionFormat } from '@/lib/releases-types'

/** Опубликованная работа автора (владелец релиза) с форматами изданий. */
export type AuthorWork = Release & { formats: EditionFormat[] }

export interface AuthorSeries {
  id: string
  title: string
  slug: string
  description: string | null
  release_count: number
}

const AUTHOR_WORK_COLUMNS = `
  r.id, r.title, r.slug, r.description, r.cover_image, r.genre,
  r.release_date, r.isbn, r.authors, r.annotation, r.editor_notes,
  r.view_count, r.status, r.design_config, r.created_at, r.updated_at,
  COALESCE(
    json_agg(DISTINCT e.format) FILTER (WHERE e.format IS NOT NULL),
    '[]'::json
  ) AS formats
`

/**
 * Публичные работы автора: опубликованные релизы, где пользователь — owner.
 *
 * Если `showcase_releases` задан (непустой массив UUID) — возвращаем только
 * указанные релизы в указанном порядке. Если NULL — fallback: все published
 * по дате (текущее поведение). Пустой массив = ничего.
 */
export async function fetchPublicAuthorWorks(userId: string): Promise<AuthorWork[]> {
  const user = await dbQueryOne<{ showcase_releases: string[] | null }>(
    'SELECT showcase_releases FROM users WHERE id = $1',
    [userId],
  )

  const showcase = user?.showcase_releases

  if (Array.isArray(showcase) && showcase.length > 0) {
    return dbQuery<AuthorWork>(
      `SELECT ${AUTHOR_WORK_COLUMNS}
       FROM releases r
       JOIN release_collaborators rc ON rc.release_id = r.id AND rc.role = 'owner'
       LEFT JOIN editions e ON e.release_id = r.id AND e.status = 'published'
       WHERE rc.user_id = $1 AND r.status = 'published' AND r.id = ANY($2)
       GROUP BY r.id
       ORDER BY array_position($2, r.id)`,
      [userId, showcase],
    )
  }

  if (Array.isArray(showcase) && showcase.length === 0) {
    return []
  }

  return dbQuery<AuthorWork>(
    `SELECT ${AUTHOR_WORK_COLUMNS}
     FROM releases r
     JOIN release_collaborators rc ON rc.release_id = r.id AND rc.role = 'owner'
     LEFT JOIN editions e ON e.release_id = r.id AND e.status = 'published'
     WHERE rc.user_id = $1 AND r.status = 'published'
     GROUP BY r.id
     ORDER BY r.release_date DESC NULLS LAST, r.created_at DESC`,
    [userId],
  )
}

/** Серии, в которые входят опубликованные работы автора. */
export async function fetchAuthorSeries(userId: string): Promise<AuthorSeries[]> {
  return dbQuery<AuthorSeries>(
    `SELECT s.id, s.title, s.slug, s.description,
            COUNT(rs.release_id)::int AS release_count
     FROM series s
     JOIN release_series rs ON rs.series_id = s.id
     JOIN releases r ON r.id = rs.release_id AND r.status = 'published'
     JOIN release_collaborators rc ON rc.release_id = r.id AND rc.role = 'owner'
     WHERE rc.user_id = $1
     GROUP BY s.id
     ORDER BY s.title ASC`,
    [userId],
  )
}

/** Последние опубликованные новости автора. */
export async function fetchAuthorLatest(userId: string, limit = 5): Promise<NewsPost[]> {
  return dbQuery<NewsPost>(
    `SELECT id, slug, section, title, content, tag, display_order, is_active,
            author_user_id, cover_image, status, published_at, created_at, updated_at
     FROM news_posts
     WHERE author_user_id = $1 AND status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $2`,
    [userId, limit],
  )
}
