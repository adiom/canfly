import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchReleaseBySlug, fetchReleaseCharacters, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchEditionsByRelease } from '@/lib/server/editions'
import { fetchPublishedChapterListByEdition } from '@/lib/server/chapters'
import { fetchSeriesById } from '@/lib/server/series'
import { fetchCharactersList } from '@/lib/server/characters'
import { fetchPublicHighlightsByRelease } from '@/lib/server/chapter-highlights'
import { ReleasePagePublic } from '@/components/release-page'
import { computeEditionMeta, getPrimaryEdition } from '@/lib/utils/editions'
import { generateReleaseSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release) return { title: 'Не найдено | canfly' }

  const title = `${release.title} | canfly`
  const description = release.annotation ?? release.description ?? `«${release.title}» на canfly`
  const url = `${BASE_URL}/release/${release.slug}`

  return {
    title,
    description,
    openGraph: {
      title, description, url,
      type: 'book',
      locale: 'ru_RU',
      siteName: 'canfly',
      ...(release.cover_image && { images: [{ url: release.cover_image, width: 600, height: 900, alt: release.title }] }),
    },
    alternates: { canonical: url },
  }
}

export default async function ReleasePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release || release.status !== 'published') notFound()

  const editions = await fetchEditionsByRelease(release.id)
  const primaryEdition = getPrimaryEdition(editions)

  // Мета по главному изданию (число глав, объём, время чтения)
  let meta = { chapterCount: 0, wordCount: 0, readingMinutes: 0, durationSeconds: 0 }
  if (primaryEdition) {
    meta = computeEditionMeta(await fetchPublishedChapterListByEdition(primaryEdition.id))
  }

  const [releaseChars, allCharacters, seriesLinks, highlights] = await Promise.all([
    fetchReleaseCharacters(release.id),
    fetchCharactersList(),
    fetchReleaseSeries(release.id),
    fetchPublicHighlightsByRelease(release.id, 6),
  ])

  const characters = releaseChars
    .map(rc => {
      const ch = allCharacters.find(c => c.id === rc.character_id)
      return ch ? { id: ch.id, name: ch.name, slug: ch.slug, avatar: ch.avatar ?? null, role: rc.role } : null
    })
    .filter(Boolean) as { id: string; name: string; slug: string; avatar: string | null; role: string }[]

  const seriesLink = seriesLinks.length > 0
    ? { series: await fetchSeriesById(seriesLinks[0].series_id), phase_number: seriesLinks[0].phase_number }
    : null

  const validSeriesLink = seriesLink && seriesLink.series
    ? { series: seriesLink.series, phase_number: seriesLink.phase_number }
    : null

  const formats = editions
    .filter(e => e.status === 'published')
    .map(e => e.format)

  const bookEditions = editions.filter(e => e.format === 'book')

  const releaseSchema = generateReleaseSchema(release, formats, BASE_URL, bookEditions, characters)
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Релизы', url: `${BASE_URL}/releases/` },
    { label: release.title, url: `${BASE_URL}/release/${release.slug}` },
  ])

  const primaryEditionTier = primaryEdition?.quality_tier ?? null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(releaseSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ReleasePagePublic
        release={release}
        editions={editions}
        primaryEditionSlug={primaryEdition?.slug ?? null}
        primaryEditionTier={primaryEditionTier}
        characters={characters}
        seriesLink={validSeriesLink}
        highlights={highlights}
        meta={meta}
      />
    </>
  )
}
