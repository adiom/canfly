import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchReleaseBySlug, fetchReleaseCharacters, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchEditionsByRelease } from '@/lib/server/editions'
import { fetchPublishedChapterListByEdition } from '@/lib/server/chapters'
import { fetchSeriesById, fetchSeriesWithReleases } from '@/lib/server/series'
import { fetchCharactersList } from '@/lib/server/characters'
import { fetchPlacesByRelease } from '@/lib/server/places'
import { fetchPublicHighlightsByRelease } from '@/lib/server/chapter-highlights'
import { getReleaseViewer } from '@/lib/server/studio-auth'
import { ReleasePagePublic } from '@/components/release-page'
import { computeEditionMeta, getPrimaryEdition } from '@/lib/utils/editions'
import { generateReleaseSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'

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
  const release = await fetchReleaseBySlug(slug)
  if (!release) return notFoundMetadata()

  if (release.status === 'published') {
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

  if (release.status === 'draft') {
    const { canViewDraft } = await getReleaseViewer(release.id)
    if (!canViewDraft) return notFoundMetadata()

    return buildMetadata({
      title: `${release.title} · черновик | canfly`,
      description: `Черновик «${release.title}» — предпросмотр для команды релиза.`,
      path: `/release/${release.slug}`,
      generatedImage: true,
      ogType: 'book',
      noindex: true,
    })
  }

  // archived: на сайте публично нет, но в Studio остаётся.
  return notFoundMetadata()
}

export default async function ReleasePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release) notFound()

  // published — всем. draft — только команде релиза (owner/editor-коллаборант
  // или админ). archived — publicly 404, в Studio остаётся.
  let preview: 'draft' | null = null
  let viewerCanEdit = false
  if (release.status !== 'published') {
    if (release.status === 'archived') notFound()
    const viewer = await getReleaseViewer(release.id)
    if (!viewer.canViewDraft) notFound()
    preview = 'draft'
    // Кнопку «Открыть в Studio» показываем только тем, кто реально может
    // открыть `/studio/releases/[id]` (admin или owner коллаборанта).
    // Editor-коллаборатор черновик видит, но в студию этого релиза не зайдёт.
    viewerCanEdit = viewer.canEdit
  }

  const editions = await fetchEditionsByRelease(release.id)
  const primaryEdition = getPrimaryEdition(editions)

  let meta = { chapterCount: 0, wordCount: 0, readingMinutes: 0, durationSeconds: 0 }
  if (primaryEdition) {
    meta = computeEditionMeta(await fetchPublishedChapterListByEdition(primaryEdition.id))
  }

  const [releaseChars, allCharacters, seriesLinks, highlights, releasePlaces] = await Promise.all([
    fetchReleaseCharacters(release.id),
    fetchCharactersList(),
    fetchReleaseSeries(release.id),
    fetchPublicHighlightsByRelease(release.id, 6),
    fetchPlacesByRelease(release.id),
  ])

  const characters = releaseChars
    .map(rc => {
      const ch = allCharacters.find(c => c.id === rc.character_id)
      return ch ? { id: ch.id, name: ch.name, slug: ch.slug, avatar: ch.avatar ?? null, role: rc.role } : null
    })
    .filter(Boolean) as { id: string; name: string; slug: string; avatar: string | null; role: string }[]

  const schemaCharacters = releaseChars
    .map(rc => allCharacters.find(c => c.id === rc.character_id))
    .filter(Boolean)
    .map(ch => ({
      name: ch!.name,
      slug: ch!.slug,
      avatar: ch!.avatar ?? null,
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
    editions,
    formats,
    characters: schemaCharacters,
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
        editions={editions}
        primaryEditionSlug={primaryEdition?.slug ?? null}
        seriesLink={validSeriesLink}
        highlights={highlights}
        meta={meta}
        characters={characters}
        otherSeriesReleases={otherSeriesReleases}
        breadcrumbs={breadcrumbItems}
        preview={preview}
        viewerCanEdit={viewerCanEdit}
      />
    </>
  )
}
