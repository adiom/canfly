import { dbQuery, dbQueryOne } from '@/lib/db'
import { fetchUserHighlights } from '@/lib/server/chapter-highlights'
import type { UserProfile } from '@/lib/types'
import type { EditionFormat, QualityTier } from '@/lib/releases-types'

/** Публичные цитаты для дашборда — фильтруем по is_public на клиенте, чтобы лишний запрос не делать. */
export async function fetchPublicQuotes(userId: string, limit = 8) {
  const rows = await fetchUserHighlights(userId, limit)
  return rows
    .filter(row => row.is_public)
    .map(row => ({
      id: row.id,
      text: row.text_content,
      release_slug: row.release_slug ?? null,
      chapter_title: row.chapter_title ?? null,
      created_at: row.created_at,
    }))
}

/** Полка «читает»: одна строка на издание — самая свежая позиция. */
export interface ShelfItem {
  edition_id: string
  edition_slug: string
  format: EditionFormat
  quality_tier: QualityTier
  release_slug: string
  release_title: string
  cover_image: string | null
  /** Номер главы в URL — позиция среди опубликованных, а не chapters.chapter_index */
  chapter_number: number
  chapter_title: string
  progress_percent: number
  last_read_at: string
}

export interface ProfileQuote {
  id: string
  text_content: string
  note: string | null
  likes_count: number
  created_at: string
  release_slug: string | null
  chapter_title: string | null
}

export interface ProfileCounts {
  quotes: number
  public_quotes: number
  editions_started: number
  friends: number
}

export async function fetchUserByHandle(handle: string) {
  return dbQueryOne<UserProfile>(
    `SELECT * FROM users
     WHERE LOWER(handle) = LOWER($1) AND COALESCE(is_deleted, FALSE) = FALSE
     LIMIT 1`,
    [handle],
  )
}

/** Полный профиль по id — для приватных страниц, где нужны tagline/created_at. */
export async function fetchUserProfileById(userId: string) {
  return dbQueryOne<UserProfile>(
    'SELECT * FROM users WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE LIMIT 1',
    [userId],
  )
}

/**
 * Последняя прочитанная глава по каждому изданию. DISTINCT ON схлопывает
 * историю прогресса до одной актуальной строки — без него полка показывала бы
 * одну книгу столько раз, сколько в ней открытых глав.
 *
 * chapter_number считается через ROW_NUMBER по опубликованным главам: маршруты
 * ридера адресуют главу позицией в этом списке, а chapters.chapter_index с ней
 * расходится, если черновик стоит в середине издания.
 */
export async function fetchShelf(userId: string, limit = 6) {
  return dbQuery<ShelfItem>(
    `WITH numbered AS (
       SELECT ch.id,
              ch.edition_id,
              ch.title,
              ROW_NUMBER() OVER (
                PARTITION BY ch.edition_id ORDER BY ch.chapter_index
              )::int AS chapter_number
       FROM chapters ch
       WHERE ch.status = 'published'
     )
     SELECT DISTINCT ON (rp.edition_id)
            rp.edition_id,
            e.slug AS edition_slug,
            e.format,
            e.quality_tier,
            r.slug AS release_slug,
            r.title AS release_title,
            r.cover_image,
            n.chapter_number,
            n.title AS chapter_title,
            rp.progress_percent::float AS progress_percent,
            rp.last_read_at
     FROM reading_progress rp
     JOIN numbered n ON n.id = rp.chapter_id
     JOIN editions e ON e.id = rp.edition_id
     JOIN releases r ON r.id = e.release_id
     WHERE rp.user_id = $1
       AND e.status = 'published'
       AND r.status = 'published'
     ORDER BY rp.edition_id, rp.last_read_at DESC
     LIMIT $2`,
    [userId, limit],
  ).then(rows =>
    [...rows].sort(
      (a, b) => new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime(),
    ),
  )
}

/**
 * Цитаты пользователя. publicOnly=true для чужого взгляда — приватные
 * хайлайты не должны утекать через публичный маршрут.
 */
export async function fetchProfileQuotes(
  userId: string,
  options: { publicOnly: boolean; limit?: number },
) {
  const { publicOnly, limit = 12 } = options
  return dbQuery<ProfileQuote>(
    `SELECT h.id,
            h.text_content,
            h.note,
            h.likes_count,
            h.created_at,
            r.slug AS release_slug,
            ch.title AS chapter_title
     FROM chapter_highlights h
     JOIN chapters ch ON ch.id = h.chapter_id
     JOIN editions e ON e.id = ch.edition_id
     JOIN releases r ON r.id = e.release_id
     WHERE h.user_id = $1
       AND ($2::boolean = false OR h.is_public = true)
     ORDER BY h.created_at DESC
     LIMIT $3`,
    [userId, publicOnly, limit],
  )
}

export async function fetchProfileCounts(userId: string): Promise<ProfileCounts> {
  const row = await dbQueryOne<ProfileCounts>(
    `SELECT
       (SELECT COUNT(*)::int FROM chapter_highlights WHERE user_id = $1) AS quotes,
       (SELECT COUNT(*)::int FROM chapter_highlights WHERE user_id = $1 AND is_public) AS public_quotes,
       (SELECT COUNT(DISTINCT edition_id)::int FROM reading_progress WHERE user_id = $1) AS editions_started,
       (SELECT COUNT(*)::int FROM character_friendships WHERE user_id = $1 AND status = 'accepted') AS friends`,
    [userId],
  )
  return row ?? { quotes: 0, public_quotes: 0, editions_started: 0, friends: 0 }
}

export interface CoreWeek {
  /** Понедельник недели, ISO-дата */
  week_start: string
  quotes: number
}

/**
 * Керн: цитаты по неделям за год. Пустые недели БД не вернёт, поэтому
 * generate_series задаёт полную сетку из 52 сегментов — иначе полоса
 * сжималась бы к активным неделям и врала про плотность.
 */
export async function fetchCoreWeeks(userId: string) {
  return dbQuery<CoreWeek>(
    `WITH weeks AS (
       SELECT generate_series(
         date_trunc('week', NOW()) - INTERVAL '51 weeks',
         date_trunc('week', NOW()),
         INTERVAL '1 week'
       ) AS week_start
     )
     SELECT to_char(w.week_start, 'YYYY-MM-DD') AS week_start,
            COUNT(h.id)::int AS quotes
     FROM weeks w
     LEFT JOIN chapter_highlights h
       ON date_trunc('week', h.created_at) = w.week_start
      AND h.user_id = $1
     GROUP BY w.week_start
     ORDER BY w.week_start`,
    [userId],
  )
}

/** Свободен ли handle. Сравнение регистронезависимое — как в idx_users_handle_lower. */
export async function isHandleAvailable(handle: string, exceptUserId: string) {
  const taken = await dbQueryOne<{ id: string }>(
    `SELECT id FROM users
     WHERE LOWER(handle) = LOWER($1) AND id <> $2 AND COALESCE(is_deleted, FALSE) = FALSE
     LIMIT 1`,
    [handle, exceptUserId],
  )
  return !taken
}

export interface UserSocialLink {
  provider: string
  label: string
  url: string
}

const SOCIAL_LABELS: Record<string, string> = {
  twitter: 'X',
  github: 'GitHub',
  google: 'Google',
  yandex: 'Яндекс',
  canfly: 'canfly',
}

/** Публичные ссылки на внешние профили — соцсети на странице автора. */
export async function fetchUserSocialLinks(userId: string): Promise<UserSocialLink[]> {
  const rows = await dbQuery<{ provider: string; url: string | null }>(
    `SELECT provider, url FROM linked_accounts
     WHERE user_id = $1 AND url IS NOT NULL AND url <> ''
     ORDER BY created_at ASC`,
    [userId],
  )
  return rows
    .filter(row => row.url)
    .map(row => ({
      provider: row.provider,
      label: SOCIAL_LABELS[row.provider] ?? row.provider,
      url: row.url as string,
    }))
}
