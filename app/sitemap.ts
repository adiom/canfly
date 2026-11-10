import type { MetadataRoute } from 'next'
import { dbQuery } from '@/lib/db'
import { fetchReleasesWithEditions } from '@/lib/server/releases'
import { fetchNewsPosts } from '@/lib/server/news'
import { fetchPublicCharactersList } from '@/lib/server/characters'
import { fetchPublishedGames } from '@/lib/server/games'
import { fetchPublicPlaces } from '@/lib/server/places'
import { fetchAllSeries } from '@/lib/server/series'
import { CATALOG_PATH, LANDING_PATH } from '@/lib/nav'
import { absoluteUrl } from '@/lib/seo/entities'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [releases, newsPosts, characters, places, games, series, authorUsers] = await Promise.all([
    fetchReleasesWithEditions({ status: 'published' }),
    fetchNewsPosts(100),
    fetchPublicCharactersList(),
    fetchPublicPlaces(),
    fetchPublishedGames(),
    fetchAllSeries(),
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
    lastModified: new Date(post.updated_at ?? post.published_at ?? post.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const characterEntries = characters
    .filter(char => char.character_type === 'person')
    .map((char) => ({
      url: `${BASE_URL}/characters/${char.slug}`,
      lastModified: new Date(char.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      images: char.avatar ? [char.avatar] : undefined,
    }))

  const placeEntries = places.map((place) => ({
    url: `${BASE_URL}/places/${place.slug}`,
    lastModified: new Date(place.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
    images: place.avatar ? [place.avatar] : undefined,
  }))

  // Хаб `/games` намеренно без записи: он noindex, как и `/places`.
  const gameEntries = games.filter(game => !game.seo_noindex).map((game) => ({
    url: `${BASE_URL}/games/${game.slug}`,
    lastModified: new Date(game.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
    images: game.cover_image ? [game.cover_image] : undefined,
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

  // Издания `/vvvvv/[slug]` — noindex с canonical на релиз, поэтому в sitemap
  // остаются только карточки произведений и отдельный лендинг `/vvvvv`.
  // У статических страниц нет надёжной даты изменения: lastmod опционален,
  // а время генерации sitemap не означает обновление содержимого страницы.
  return [
    {
      url: absoluteUrl(LANDING_PATH),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}${CATALOG_PATH}`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/news`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      // Хаб персонажей индексируется (фильтры — нет), поэтому он в карте.
      url: `${BASE_URL}/characters`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/colors`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/vvvvv`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...releaseEntries,
    ...newsEntries,
    ...characterEntries,
    ...placeEntries,
    ...gameEntries,
    ...seriesEntries,
    ...authorEntries,
  ]
}
