import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { getCurrentUser, getSystemRoles } from '@/lib/server/session'
import { fetchChapterHighlights } from '@/lib/server/chapter-highlights'
import { fetchReadingProgress } from '@/lib/server/reading-progress'
import { SpreadReader } from '@/components/spread-reader'
import type { ReaderUserRole } from '@/components/spread-reader'
import { ReleaseComicReader } from '@/components/release-comic-reader'
import { ReleaseAudioPlayer } from '@/components/release-audio-player'
import { ArtworkViewer } from '@/components/artwork-viewer'
import { JsonLd } from '@/components/seo/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { generateEditionSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata, stripHtml } from '@/lib/seo/metadata'
import { computeEditionMeta, EDITION_FORMAT_LABELS, isAudioFormat } from '@/lib/utils/editions'
import { fetchSeriesById } from '@/lib/server/series'

export const dynamic = 'force-dynamic'

/**
 * generateMetadata и сама страница запрашивают издание с релизом независимо.
 * `cache()` схлопывает эти пары в один запрос на рендер — `dbQuery` собственной
 * дедупликации не имеет.
 */
const loadEdition = cache((idOrSlug: string) => fetchEditionByIdOrSlug(idOrSlug))
const loadRelease = cache((releaseId: string) => fetchReleaseById(releaseId))
const loadChapters = cache((editionId: string) => fetchPublishedChaptersByEdition(editionId))

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const edition = await loadEdition(slug)

  if (!edition || edition.status !== 'published') return notFoundMetadata()

  const release = await loadRelease(edition.release_id)
  if (!release || release.status !== 'published') return notFoundMetadata()

  const formatLabel = (EDITION_FORMAT_LABELS[edition.format] ?? edition.format).toLowerCase()

  return buildMetadata({
    title: `${release.title} — ${formatLabel} | canfly`,
    description:
      release.description ??
      release.annotation ??
      `«${release.title}» — ${formatLabel} на canfly`,
    // Издание открывается и по UUID, и по слагу — канонический адрес один, по слагу.
    path: `/vvvvv/${edition.slug || edition.id}`,
    // og:image — из opengraph-image.tsx рядом.
    generatedImage: true,
    // og:type `book` — только для читаемых форматов: у аудио нет ни автора-книги,
    // ни ISBN, которые ожидает эта разметка.
    ogType: isAudioFormat(edition.format) || edition.format === 'artwork' ? 'website' : 'book',
    publishedTime: release.release_date ?? edition.created_at,
    modifiedTime: edition.updated_at,
  })
}

export default async function VvvvvReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const edition = await loadEdition(slug)
  if (!edition || edition.status !== 'published') notFound()

  const release = await loadRelease(edition.release_id)
  if (!release || release.status !== 'published') notFound()
  if (edition.format === 'artwork') {
    if (!edition.artwork_url) notFound()

    const seriesLinks = await fetchReleaseSeries(release.id)
    const series = seriesLinks.length > 0 ? await fetchSeriesById(seriesLinks[0].series_id) : null
    const editionSlug = edition.slug || edition.id
    const breadcrumbItems = series
      ? [
          { label: 'canfly', url: '/' },
          { label: 'Серии', url: '/series' },
          { label: series.title, url: `/series/${series.slug}` },
          { label: release.title, url: `/release/${release.slug}` },
          { label: 'Картина', url: `/vvvvv/${editionSlug}` },
        ]
      : [
          { label: 'canfly', url: '/' },
          { label: 'Релизы', url: '/releases' },
          { label: release.title, url: `/release/${release.slug}` },
          { label: 'Картина', url: `/vvvvv/${editionSlug}` },
        ]
    const jsonLd = generateEditionSchema({
      edition,
      release,
      chapters: [],
      meta: computeEditionMeta([]),
      series: series ? { slug: series.slug, title: series.title } : null,
    })

    return (
      <>
        <JsonLd schemas={[jsonLd]} />
        <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <ArtworkViewer
          imageUrl={edition.artwork_url}
          title={release.title}
          description={stripHtml(release.annotation ?? release.description) || null}
        />
      </>
    )
  }

  // Главы и пользователь нужны только обычным ридерам; картине они не требуются.
  const [chapters, user] = await Promise.all([
    loadChapters(edition.id),
    getCurrentUser(),
  ])
  if (chapters.length === 0) notFound()

  // Серия нужна только разметке (`isPartOf`), поэтому берётся отдельно и не
  // блокирует основной круг запросов.
  const seriesLinks = await fetchReleaseSeries(release.id)
  const series = seriesLinks.length > 0 ? await fetchSeriesById(seriesLinks[0].series_id) : null

  const editionSlug = edition.slug || edition.id

  const breadcrumbItems = series
    ? [
        { label: 'canfly', url: '/' },
        { label: 'Серии', url: '/series' },
        { label: series.title, url: `/series/${series.slug}` },
        { label: release.title, url: `/release/${release.slug}` },
        { label: 'Читать', url: `/vvvvv/${editionSlug}` },
      ]
    : [
        { label: 'canfly', url: '/' },
        { label: 'Релизы', url: '/releases' },
        { label: release.title, url: `/release/${release.slug}` },
        { label: 'Читать', url: `/vvvvv/${editionSlug}` },
      ]

  const jsonLd = (
    <JsonLd
      schemas={[
        generateEditionSchema({
          edition,
          release,
          chapters,
          meta: computeEditionMeta(chapters),
          series: series ? { slug: series.slug, title: series.title } : null,
        }),
      ]}
    />
  )

  if (edition.format === 'comic') {
    return (
      <>
        {jsonLd}
        <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <ReleaseComicReader release={release} edition={edition} chapters={chapters} />
      </>
    )
  }

  if (
    edition.format === 'audiobook' ||
    edition.format === 'audiorelease' ||
    edition.format === 'album'
  ) {
    return (
      <>
        {jsonLd}
        <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <ReleaseAudioPlayer release={release} edition={edition} chapters={chapters} />
      </>
    )
  }

  if (edition.format !== 'book' && edition.format !== 'magazine') notFound()

  // Системные роли и прогресс чтения зависят только от user — тоже параллельно.
  const readerContext = user
    ? await Promise.all([getSystemRoles(user.id), fetchReadingProgress(edition.id, user.id)])
    : null
  const systemRoles = readerContext?.[0] ?? []
  const progress = readerContext?.[1] ?? null

  const userRole: ReaderUserRole | null = user
    ? user.is_admin
      ? 'admin'
      : systemRoles.includes('editor')
        ? 'editor'
        : user.public_role === 'author'
          ? 'author'
          : 'reader'
    : null

  const progressChapterIndex = progress
    ? chapters.findIndex(chapter => chapter.id === progress.chapter_id)
    : -1
  const initialChapterIndex = progressChapterIndex >= 0 ? progressChapterIndex : 0

  const initialHighlights = await fetchChapterHighlights({
    chapterId: chapters[initialChapterIndex].id,
    currentUserId: user?.id ?? null,
  })

  return (
    <>
      {jsonLd}
      <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <SpreadReader
        release={release}
        edition={edition}
        chapters={chapters}
        initialChapterIndex={initialChapterIndex}
        initialPosition={progress?.position ?? null}
        initialProgressPercent={progress ? Number(progress.progress_percent) : 0}
        initialProgressUpdatedAt={progress?.last_read_at ? new Date(progress.last_read_at).getTime() : 0}
        currentUserId={user?.id ?? null}
        initialHighlights={initialHighlights}
        userRole={userRole}
        userName={user?.display_name ?? null}
      />
    </>
  )
}
