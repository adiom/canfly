import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchReleaseBySlug, fetchReleaseCharacters, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchEditionsByRelease } from '@/lib/server/editions'
import { fetchPublishedChapterListByEdition } from '@/lib/server/chapters'
import { fetchSeriesById, fetchSeriesWithReleases } from '@/lib/server/series'
import { fetchCharactersList } from '@/lib/server/characters'
import { fetchPublicHighlightsByRelease } from '@/lib/server/chapter-highlights'
import { ReleasePagePublic } from '@/components/release-page'
import { computeEditionMeta, getPrimaryEdition } from '@/lib/utils/editions'
import { generateReleaseSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'
import { CATALOG_PATH } from '@/lib/nav'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release || release.status !== 'published') return notFoundMetadata()

  return buildMetadata({
    title: `${release.title} | canfly`,
    description: release.description ?? release.annotation ?? `«${release.title}» на canfly`,
    path: `/release/${release.slug}`,
    // og:image приходит из opengraph-image.tsx рядом — обложка «как есть» в
    // 1200×630 обрезалась бы соцсетями.
    generatedImage: true,
    ogType: 'book',
    publishedTime: release.release_date ?? release.created_at,
    modifiedTime: release.updated_at,
  })
}

export default async function ReleasePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release || release.status !== 'published') notFound()

  const editions = await fetchEditionsByRelease(release.id)
  const primaryEdition = getPrimaryEdition(editions)

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

  // Для разметки нужен ещё character_type: город должен стать Place, а не Person.
  const schemaCharacters = releaseChars
    .map(rc => allCharacters.find(c => c.id === rc.character_id))
    .filter(Boolean)
    .map(ch => ({
      name: ch!.name,
      slug: ch!.slug,
      avatar: ch!.avatar ?? null,
      character_type: ch!.character_type,
    }))

  // Карта slug → role. Используется в JSON-LD, чтобы выделить protagonist
  // (role = 'main') для поля `about`.
  const characterRoles = new Map<string, string>()
  for (const rc of releaseChars) {
    const ch = allCharacters.find(c => c.id === rc.character_id)
    if (ch) characterRoles.set(ch.slug, rc.role)
  }

  const seriesLink = seriesLinks.length > 0
    ? { series: await fetchSeriesById(seriesLinks[0].series_id), phase_number: seriesLinks[0].phase_number }
    : null

  const validSeriesLink = seriesLink && seriesLink.series
    ? { series: seriesLink.series, phase_number: seriesLink.phase_number }
    : null

  let otherSeriesReleases: Array<{ id: string; title: string; slug: string; annotation: string | null; cover_image: string | null; release_date: string | null; phase_number: number | null }> = []
  if (validSeriesLink?.series) {
    const seriesData = await fetchSeriesWithReleases(validSeriesLink.series.slug)
    otherSeriesReleases = (seriesData?.releases ?? []).filter(r => r.id !== release.id)
  }

  const formats = editions
    .filter(e => e.status === 'published')
    .map(e => e.format)

  const releaseSchema = generateReleaseSchema({
    release,
    // Все опубликованные издания, а не только book: комиксы, аудиокниги и
    // журналы раньше в workExample не попадали вообще.
    editions,
    formats,
    characters: schemaCharacters,
    characterRoles,
    series: validSeriesLink?.series
      ? { slug: validSeriesLink.series.slug, title: validSeriesLink.series.title }
      : null,
    primaryMeta: meta,
    primaryEditionId: primaryEdition?.id ?? null,
  })
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Релизы', url: `${BASE_URL}${CATALOG_PATH}` },
    { label: release.title, url: `${BASE_URL}/release/${release.slug}` },
  ])

  return (
    <>
      <JsonLd schemas={[releaseSchema, breadcrumbSchema]} />
      <ReleasePagePublic
        release={release}
        editions={editions}
        primaryEditionSlug={primaryEdition?.slug ?? null}
        seriesLink={validSeriesLink}
        highlights={highlights}
        meta={meta}
        characters={characters}
        otherSeriesReleases={otherSeriesReleases}
        breadcrumbs={[
          { label: 'canfly', url: '/' },
          { label: 'Релиз', url: '/releases' },
          { label: release.title, url: `/release/${release.slug}` },
        ]}
      />
    </>
  )
}
