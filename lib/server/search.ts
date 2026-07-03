import { dbQuery } from '@/lib/db'

export interface SearchResultCharacter {
  kind: 'character'
  id: string
  name: string
  slug: string
  bio: string | null
  avatar: string | null
}

export interface SearchResultNews {
  kind: 'news'
  id: string
  title: string
  section: string
  tag: string | null
  snippet: string | null
}

export interface SearchResultRelease {
  kind: 'release'
  id: string
  title: string
  slug: string
  genre: string | null
  cover_image: string | null
  snippet: string | null
}

export interface SearchResults {
  releases: SearchResultRelease[]
  characters: SearchResultCharacter[]
  news: SearchResultNews[]
  total: number
  query: string
}

export interface AutocompleteItem {
  kind: 'character' | 'news' | 'release'
  id: string
  title: string
  subtitle: string
  href: string
  image: string | null
}

export async function searchAll(q: string): Promise<SearchResults> {
  const trimmed = q.trim()
  const pattern = `%${trimmed}%`
  const prefix = `${trimmed}%`

  const rows = await dbQuery<{
    kind: string
    id: string
    title: string
    slug: string
    type: string | null
    description: string | null
    cover_image: string | null
    label: string | null
    bio: string | null
    avatar: string | null
    section: string | null
    tag: string | null
    snippet: string | null
    view_count: number | null
  }>(
    `
    SELECT
      'release'       AS kind,
      id::text,
      title,
      slug,
      genre           AS type,
      description,
      cover_image,
      NULL::text      AS label,
      NULL::text      AS bio,
      NULL::text      AS avatar,
      NULL::text      AS section,
      NULL::text      AS tag,
      LEFT(COALESCE(annotation, description), 160) AS snippet,
      view_count,
      CASE
        WHEN LOWER(title) = LOWER($2)            THEN 1
        WHEN LOWER(title) LIKE LOWER($3)         THEN 2
        WHEN LOWER(title) LIKE LOWER($1)         THEN 3
        ELSE 4
      END AS rank
    FROM releases
    WHERE status = 'published'
      AND (
        LOWER(title) LIKE LOWER($1)
        OR LOWER(COALESCE(annotation, '')) LIKE LOWER($1)
        OR LOWER(COALESCE(description, '')) LIKE LOWER($1)
        OR LOWER(COALESCE(genre, '')) LIKE LOWER($1)
        OR LOWER(COALESCE(authors::text, '')) LIKE LOWER($1)
        OR word_similarity($2, title) >= 0.4
      )

    UNION ALL

    SELECT
      'character'     AS kind,
      id::text,
      name            AS title,
      slug,
      NULL::text      AS type,
      NULL::text      AS description,
      avatar          AS cover_image,
      NULL::text      AS label,
      bio,
      avatar,
      NULL::text      AS section,
      NULL::text      AS tag,
      NULL::text      AS snippet,
      NULL::integer   AS view_count,
      CASE
        WHEN LOWER(name) = LOWER($2)             THEN 1
        WHEN LOWER(name) LIKE LOWER($3)          THEN 2
        WHEN LOWER(name) LIKE LOWER($1)          THEN 3
        ELSE 4
      END AS rank
    FROM characters
    WHERE LOWER(name) LIKE LOWER($1)
       OR LOWER(bio) LIKE LOWER($1)
       OR LOWER(full_description) LIKE LOWER($1)
       OR word_similarity($2, name) >= 0.4

    UNION ALL

    SELECT
      'news'          AS kind,
      id::text,
      title,
      ''              AS slug,
      NULL::text      AS type,
      content         AS description,
      NULL::text      AS cover_image,
      NULL::text      AS label,
      NULL::text      AS bio,
      NULL::text      AS avatar,
      section,
      tag,
      LEFT(content, 160) AS snippet,
      NULL::integer   AS view_count,
      CASE
        WHEN LOWER(title) = LOWER($2)            THEN 1
        WHEN LOWER(title) LIKE LOWER($3)         THEN 2
        WHEN LOWER(title) LIKE LOWER($1)         THEN 3
        ELSE 4
      END AS rank
    FROM news_posts
    WHERE status = 'published'
      AND (
        LOWER(title)   LIKE LOWER($1)
        OR LOWER(content) LIKE LOWER($1)
        OR LOWER(tag)     LIKE LOWER($1)
        OR LOWER(section) LIKE LOWER($1)
        OR word_similarity($2, title) >= 0.4
      )

    ORDER BY rank ASC, view_count DESC NULLS LAST, title ASC
    LIMIT 50
    `,
    [pattern, trimmed, prefix],
  )

  const releases: SearchResultRelease[] = []
  const characters: SearchResultCharacter[] = []
  const news: SearchResultNews[] = []

  for (const row of rows) {
    if (row.kind === 'release') {
      releases.push({
        kind: 'release',
        id: row.id,
        title: row.title,
        slug: row.slug,
        genre: row.type,
        cover_image: row.cover_image,
        snippet: row.snippet,
      })
    } else if (row.kind === 'character') {
      characters.push({
        kind: 'character',
        id: row.id,
        name: row.title,
        slug: row.slug,
        bio: row.bio,
        avatar: row.avatar,
      })
    } else if (row.kind === 'news') {
      news.push({
        kind: 'news',
        id: row.id,
        title: row.title,
        section: row.section ?? '',
        tag: row.tag,
        snippet: row.snippet,
      })
    }
  }

  return {
    releases,
    characters,
    news,
    total: releases.length + characters.length + news.length,
    query: q,
  }
}

export async function searchAutocomplete(q: string, limit = 5): Promise<AutocompleteItem[]> {
  const trimmed = q.trim()
  const pattern = `%${trimmed}%`
  const prefix = `${trimmed}%`
  const releaseLimit = Math.max(2, Math.ceil(limit / 2))
  const otherLimit = Math.max(1, Math.floor(limit / 3))

  const rows = await dbQuery<{
    kind: string
    id: string
    title: string
    slug: string
    type: string | null
    cover_image: string | null
    avatar: string | null
    label: string | null
    section: string | null
  }>(
    `
    (
      SELECT 'release' AS kind, id::text, title, slug, genre AS type,
             cover_image, NULL AS avatar, NULL AS label, NULL AS section
      FROM releases
      WHERE status = 'published'
        AND (
          LOWER(title) LIKE LOWER($1)
          OR LOWER(COALESCE(annotation, '')) LIKE LOWER($1)
          OR LOWER(COALESCE(genre, '')) LIKE LOWER($1)
          OR LOWER(COALESCE(authors::text, '')) LIKE LOWER($1)
          OR word_similarity($2, title) >= 0.4
        )
      ORDER BY
        CASE
          WHEN LOWER(title) = LOWER($2)   THEN 1
          WHEN LOWER(title) LIKE LOWER($3) THEN 2
          WHEN LOWER(title) LIKE LOWER($1) THEN 3
          ELSE 4
        END ASC,
        view_count DESC NULLS LAST,
        title ASC
      LIMIT $4
    )
    UNION ALL
    (
      SELECT 'character' AS kind, id::text, name AS title, slug, NULL AS type,
             NULL AS cover_image, avatar, NULL AS label, NULL AS section
      FROM characters
      WHERE LOWER(name) LIKE LOWER($1) OR LOWER(bio) LIKE LOWER($1)
         OR word_similarity($2, name) >= 0.4
      ORDER BY
        CASE
          WHEN LOWER(name) = LOWER($2)    THEN 1
          WHEN LOWER(name) LIKE LOWER($3) THEN 2
          WHEN LOWER(name) LIKE LOWER($1) THEN 3
          ELSE 4
        END ASC,
        name ASC
      LIMIT $5
    )
    UNION ALL
    (
      SELECT 'news' AS kind, id::text, title, '' AS slug, NULL AS type,
             NULL AS cover_image, NULL AS avatar, NULL AS label, section
      FROM news_posts
      WHERE status = 'published'
        AND (LOWER(title) LIKE LOWER($1) OR LOWER(content) LIKE LOWER($1)
             OR word_similarity($2, title) >= 0.4)
      ORDER BY
        CASE
          WHEN LOWER(title) = LOWER($2)    THEN 1
          WHEN LOWER(title) LIKE LOWER($3) THEN 2
          WHEN LOWER(title) LIKE LOWER($1) THEN 3
          ELSE 4
        END ASC,
        title ASC
      LIMIT $6
    )
    `,
    [pattern, trimmed, prefix, releaseLimit, otherLimit, otherLimit],
  )

  return rows.map((row) => {
    if (row.kind === 'release') {
      return {
        kind: 'release' as const,
        id: row.id,
        title: row.title,
        subtitle: row.type ? `Релиз · ${row.type}` : 'Релиз',
        href: `/release/${row.slug}`,
        image: row.cover_image,
      }
    } else if (row.kind === 'character') {
      return {
        kind: 'character' as const,
        id: row.id,
        title: row.title,
        subtitle: 'Персонаж',
        href: `/characters/${row.slug}`,
        image: row.avatar,
      }
    } else {
      return {
        kind: 'news' as const,
        id: row.id,
        title: row.title,
        subtitle: row.section ?? 'Новости',
        href: `/news/${row.id}`,
        image: null,
      }
    }
  })
}
