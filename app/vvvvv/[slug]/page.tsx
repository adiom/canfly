import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchAllChaptersByEdition, fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { getCurrentUser, getSystemRoles } from '@/lib/server/session'
import { z } from 'zod'
import { fetchChapterHighlightById, canManageChapterEditorialNotes, fetchChapterHighlights } from '@/lib/server/chapter-highlights'
import { fetchReadingProgress } from '@/lib/server/reading-progress'
import { ReaderPreviewNotice } from '@/components/vvvvv/reader-preview-notice'
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
const loadUser = cache(getCurrentUser)
const loadChapters = cache((editionId: string, isAdmin: boolean) => isAdmin
  ? fetchAllChaptersByEdition(editionId)
  : fetchPublishedChaptersByEdition(editionId))

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const edition = await loadEdition(slug)

  if (!edition) return notFoundMetadata()

  const release = await loadRelease(edition.release_id)
  if (!release) return notFoundMetadata()
  if (edition.status !== 'published' || release.status !== 'published') {
    const user = await loadUser()
    if (!user?.is_admin) return notFoundMetadata()
    return {
      title: 'Предпросмотр администратора | canfly',
      robots: { index: false, follow: false },
    }
  }

  const formatLabel = (EDITION_FORMAT_LABELS[edition.format] ?? edition.format).toLowerCase()

  return buildMetadata({
    title: `${release.title} — ${formatLabel} | canfly`,
    description:
      release.description ??
      release.annotation ??
      `«${release.title}» — ${formatLabel} на canfly`,
    // OG-карточка ведёт в издание; canonical всех изданий — родительский релиз.
    path: `/vvvvv/${edition.slug || edition.id}`,
    canonicalPath: `/release/${release.slug}`,
    noindex: true,
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
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ highlight?: string | string[] }>
}) {
  const { slug } = await params
  const [edition, user] = await Promise.all([loadEdition(slug), loadUser()])
  const isAdmin = user?.is_admin === true
  if (!edition || (!isAdmin && edition.status !== 'published')) notFound()

  const release = await loadRelease(edition.release_id)
  if (!release || (!isAdmin && release.status !== 'published')) notFound()

  const previewNotice = isAdmin ? (
    <ReaderPreviewNotice releaseStatus={release.status} editionStatus={edition.status} />
  ) : null
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
        {!isAdmin && <JsonLd schemas={[jsonLd]} />}
        {previewNotice}
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

  // Полный текст черновиков загружается только после серверной проверки is_admin.
  const chapters = await loadChapters(edition.id, isAdmin)
  const readerPreview = isAdmin ? (
    <ReaderPreviewNotice
      releaseStatus={release.status}
      editionStatus={edition.status}
      unpublishedChapterCount={chapters.filter(chapter => chapter.status !== 'published').length}
    />
  ) : null
  if (chapters.length === 0) {
    if (!isAdmin) notFound()
    return (
      <>
        {readerPreview}
        <p className="px-5 py-10 text-center text-[var(--cf-text-2)]">В этом издании пока нет глав.</p>
      </>
    )
  }

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

  const jsonLd = !isAdmin && (
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
        {readerPreview}
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
        {readerPreview}
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
  const requested = z.string().uuid().safeParse((await searchParams).highlight)
  const target = requested.success ? await fetchChapterHighlightById(requested.data, user?.id ?? null) : null
  const targetIndex = target ? chapters.findIndex(chapter => chapter.id === target.chapter_id) : -1
  const initialChapterIndex = targetIndex >= 0 ? targetIndex : Math.max(0, progressChapterIndex)
  const canManageNotes = user ? await canManageChapterEditorialNotes(chapters[initialChapterIndex].id, user.id, user.is_admin) : false

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
        previewNotice={readerPreview}
        initialChapterIndex={initialChapterIndex}
        canManageNotes={canManageNotes}
        initialHighlightId={targetIndex >= 0 ? target?.id : undefined}
        initialPosition={targetIndex < 0 ? progress?.position ?? null : null}
        initialProgressPercent={targetIndex < 0 && progress ? Number(progress.progress_percent) : 0}
        initialProgressUpdatedAt={targetIndex >= 0 ? 0 : progress?.last_read_at ? new Date(progress.last_read_at).getTime() : 0}
        currentUserId={user?.id ?? null}
        initialHighlights={initialHighlights}
        userRole={userRole}
        userName={user?.display_name ?? null}
      />
    </>
  )
}
