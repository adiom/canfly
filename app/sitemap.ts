import type { MetadataRoute } from 'next'
import { fetchReleasesWithEditions } from '@/lib/server/releases'
import { fetchPublishedEditionsForSitemap } from '@/lib/server/editions'
import { fetchNewsPosts } from '@/lib/server/news'
import { fetchCharactersList } from '@/lib/server/characters'
import { fetchAllSeries } from '@/lib/server/series'
import { getEditionTocUrl } from '@/lib/utils/editions'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [releases, editions, newsPosts, characters, series] = await Promise.all([
    fetchReleasesWithEditions({ status: 'published' }),
    fetchPublishedEditionsForSitemap(),
    fetchNewsPosts(100),
    fetchCharactersList(),
    fetchAllSeries(),
  ])

  const releaseEntries = releases.map((release) => ({
    url: `${BASE_URL}/release/${release.slug}`,
    lastModified: new Date(release.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
    images: release.cover_image ? [release.cover_image] : undefined,
  }))

  // Оглавления изданий — точки входа к главам, до этого главы были сиротами
  const editionEntries = editions.map((edition) => ({
    url: `${BASE_URL}${getEditionTocUrl(edition.release_slug, edition)}`,
    lastModified: new Date(edition.release_updated_at),
    changeFrequency: 'weekly' as const,
    priority: edition.quality_tier === 'draft' ? 0.6 : 0.8,
  }))

  const newsEntries = newsPosts.map((post) => ({
    url: `${BASE_URL}/news/${post.id}`,
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

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/releases`,
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
    ...releaseEntries,
    ...editionEntries,
    ...newsEntries,
    ...characterEntries,
    ...seriesEntries,
  ]
}