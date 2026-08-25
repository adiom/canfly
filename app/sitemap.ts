import type { MetadataRoute } from 'next'
import { dbQuery } from '@/lib/db'
import { fetchReleasesWithEditions } from '@/lib/server/releases'
import { fetchNewsPosts } from '@/lib/server/news'
import { fetchPublicCharactersList } from '@/lib/server/characters'
import { fetchAllSeries } from '@/lib/server/series'
import { fetchPublishedEditionsForSitemap } from '@/lib/server/editions'
import { CATALOG_PATH, LANDING_PATH } from '@/lib/nav'
import { getEditionTocUrl } from '@/lib/utils/editions'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [releases, newsPosts, characters, series, editions, authorUsers] = await Promise.all([
    fetchReleasesWithEditions({ status: 'published' }),
    fetchNewsPosts(100),
    fetchPublicCharactersList(),
    fetchAllSeries(),
    fetchPublishedEditionsForSitemap(),
    // В индекс — только публичные профили авторов (reader и editor не попадают).
    dbQuery<{ handle: string; updated_at: string }>(
      `SELECT handle, updated_at FROM users
       WHERE public_role = 'author' AND profile_is_public = TRUE
         AND COALESCE(is_deleted, FALSE) = FALSE`,
    ),
  ])

  const releaseEntries = releases.map((release) => ({
    url: `${BASE_URL}/release/${release.slug}`,
    lastModified: new Date(release.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
    images: release.cover_image ? [release.cover_image] : undefined,
  }))

  const newsEntries = newsPosts.map((post) => ({
    url: `${BASE_URL}/news/${post.slug}`,
    lastModified: new Date(post.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const characterEntries = characters.map((char) => ({
    url: `${BASE_URL}/characters/${char.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
    images: char.avatar ? [char.avatar] : undefined,
  }))

  const seriesEntries = series.map((s) => ({
    url: `${BASE_URL}/series/${s.slug}`,
    lastModified: new Date(s.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Публичные страницы авторов: /user/{handle} — канонический URL.
  const authorEntries = authorUsers.map((u) => ({
    url: `${BASE_URL}/user/${u.handle}`,
    lastModified: new Date(u.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // Все издания ссылаются на `/vvvvv/[editionSlug]`. Приоритет ниже релиза:
  // страница релиза остаётся главной SEO-точкой.
  const editionEntries = editions.map((edition) => ({
    url: `${BASE_URL}${getEditionTocUrl(edition.release_slug, edition)}`,
    lastModified: new Date(edition.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: `${BASE_URL}${LANDING_PATH}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}${CATALOG_PATH}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/news`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/characters`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/colors`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/vvvvv`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...releaseEntries,
    ...editionEntries,
    ...newsEntries,
    ...characterEntries,
    ...seriesEntries,
    ...authorEntries,
  ]
}
