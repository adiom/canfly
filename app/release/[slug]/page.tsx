import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cache } from 'react'
import { fetchReleaseBySlug, fetchReleaseCharacters, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchEditionsByRelease, fetchReleaseChapterCounts } from '@/lib/server/editions'
import { fetchPublishedChapterListByEdition } from '@/lib/server/chapters'
import { fetchSeriesById, fetchSeriesWithReleases } from '@/lib/server/series'
import { fetchCharactersList } from '@/lib/server/characters'
import { fetchGamesByRelease } from '@/lib/server/games'
import { fetchPlacesByRelease } from '@/lib/server/places'
import { fetchPublicHighlightsByRelease } from '@/lib/server/chapter-highlights'
import { resolveCharacterChatAvailability } from '@/lib/ai/character-chat/availability'
import { getReleaseViewer } from '@/lib/server/studio-auth'
import { ReleasePagePublic } from '@/components/release-page'
import { canOpenEdition, computeEditionMeta, getPrimaryEdition } from '@/lib/utils/editions'
import { generateReleaseSchema } from '@/lib/seo/schema'
import { notFoundMetadata } from '@/lib/seo/metadata'
import { getReleaseMetadata } from '@/lib/seo/release-metadata'
import { JsonLd } from '@/components/seo/json-ld'

const getRelease = cache(fetchReleaseBySlug)
const getViewer = cache(getReleaseViewer)

async function getEditions(releaseId: string) {
  const [editions, chapterCounts] = await Promise.all([
    fetchEditionsByRelease(releaseId),
    fetchReleaseChapterCounts(releaseId),
  ])
  const available = editions.filter(edition => canOpenEdition(edition, chapterCounts[edition.id] ?? 0))
  const primary = getPrimaryEdition(available)
  const chapters = primary ? await fetchPublishedChapterListByEdition(primary.id) : []
  return { editions, available, primary, meta: computeEditionMeta(chapters) }
}

async function getSeries(releaseId: string) {
  const [link] = await fetchReleaseSeries(releaseId)
  const series = link ? await fetchSeriesById(link.series_id) : null
  const seriesData = series ? await fetchSeriesWithReleases(series.slug) : null
  return {
    link: link && series ? { series, phase_number: link.phase_number } : null,
    otherReleases: (seriesData?.releases ?? []).filter(release => release.id !== releaseId),
  }
}

/**
 * Страница читается по сессии: черновик (draft) виден только команде релиза.
 * Без `force-dynamic` Next статически закэшировал бы рендер по первому запросу
 * и утёк бы draft публичному посетителю. Каталог (`/releases`) и sitemap на
 * draft не ссылаются, поэтому дополнительная защита от индексации — `noindex`
 * в `generateMetadata` ниже.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const release = await getRelease(slug)
  if (!release) return notFoundMetadata()

  if (release.status === 'draft') {
    const { canViewDraft } = await getViewer(release.id)
    if (!canViewDraft) return notFoundMetadata()
  }
  return getReleaseMetadata(release)
}

export default async function ReleasePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const release = await getRelease(slug)
  if (!release) notFound()

  // published — всем. draft — только команде релиза (owner/editor-коллаборант
  // или админ). archived — publicly 404, в Studio остаётся.
  let preview: 'draft' | null = null
  let viewerCanEdit = false
  if (release.status !== 'published') {
    if (release.status === 'archived') notFound()
    const viewer = await getViewer(release.id)
    if (!viewer.canViewDraft) notFound()
    preview = 'draft'
    // Кнопку «Открыть в Studio» показываем только тем, кто реально может
    // открыть `/studio/releases/[id]` (admin или owner коллаборанта).
    // Editor-коллаборатор черновик видит, но в студию этого релиза не зайдёт.
    viewerCanEdit = viewer.canEdit
  }

  const [editionData, seriesData, releaseChars, allCharacters, highlights, releasePlaces, games] = await Promise.all([
    getEditions(release.id),
    getSeries(release.id),
    fetchReleaseCharacters(release.id),
    fetchCharactersList(),
    preview ? [] : fetchPublicHighlightsByRelease(release.id, 12),
    fetchPlacesByRelease(release.id),
    fetchGamesByRelease(release.id),
  ])
  const { editions, available: availableEditions, primary: primaryEdition, meta } = editionData
  const { link: validSeriesLink, otherReleases: otherSeriesReleases } = seriesData

  const charactersById = new Map(allCharacters.map(character => [character.id, character]))
  const characters = releaseChars.flatMap(({ character_id, role }) => {
    const character = charactersById.get(character_id)
    if (!character) return []
    const { id, name, slug, avatar, bio } = character
    const canChat = resolveCharacterChatAvailability({ character }).canGenerate
    return [{ id, name, slug, avatar: avatar ?? null, bio, role, canChat }]
  })

  // Карта slug → role. Используется в JSON-LD, чтобы выделить protagonist
  // (role = 'main') для поля `about`.
  const characterRoles = new Map(characters.map(character => [character.slug, character.role]))

  const formats = editions
    .filter(e => e.status === 'published')
    .map(e => e.format)

  const releaseSchema = generateReleaseSchema({
    release,
    editions,
    formats,
    characters,
    characterRoles,
    places: releasePlaces.map(p => ({ name: p.name, slug: p.slug })),
    series: validSeriesLink?.series
      ? { slug: validSeriesLink.series.slug, title: validSeriesLink.series.title }
      : null,
    primaryMeta: meta,
    primaryEditionId: primaryEdition?.id ?? null,
  })
  const breadcrumbItems = validSeriesLink
    ? [
        { label: 'canfly', url: '/' },
        { label: 'Серии', url: '/series' },
        { label: validSeriesLink.series.title, url: `/series/${validSeriesLink.series.slug}` },
        { label: release.title, url: `/release/${release.slug}` },
      ]
    : [
        { label: 'canfly', url: '/' },
        { label: 'Релизы', url: '/releases' },
        { label: release.title, url: `/release/${release.slug}` },
      ]

  return (
    <>
      {/* Schema.org нужен только опубликованной странице: draft закрыт от
          индексации через noindex, лишняя разметка в нём не нужна. */}
      {preview !== 'draft' && <JsonLd schemas={[releaseSchema]} />}
      <ReleasePagePublic
        release={release}
        editions={preview ? editions.filter(edition => edition.status !== 'archived') : availableEditions}
        primaryEditionSlug={primaryEdition?.slug ?? null}
        seriesLink={validSeriesLink}
        highlights={highlights}
        meta={meta}
        characters={characters}
        games={games}
        places={releasePlaces}
        otherSeriesReleases={otherSeriesReleases}
        breadcrumbs={breadcrumbItems}
        preview={preview}
        viewerCanEdit={viewerCanEdit}
      />
    </>
  )
}
