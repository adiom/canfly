import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { fetchChapterHighlights } from '@/lib/server/chapter-highlights'
import { fetchReadingProgress } from '@/lib/server/reading-progress'
import { SpreadReader } from '@/components/spread-reader'
import { ReleaseComicReader } from '@/components/release-comic-reader'
import { ReleaseAudioPlayer } from '@/components/release-audio-player'
import { JsonLd } from '@/components/seo/json-ld'
import { generateEditionSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { computeEditionMeta, EDITION_FORMAT_LABELS, isAudioFormat } from '@/lib/utils/editions'
import { fetchSeriesById } from '@/lib/server/series'
import { CATALOG_PATH } from '@/lib/nav'
import type { UserRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

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
    ogType: isAudioFormat(edition.format) ? 'website' : 'book',
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

  // Релиз, главы и пользователь друг от друга не зависят — один круг вместо трёх.
  const [release, chapters, user] = await Promise.all([
    loadRelease(edition.release_id),
    loadChapters(edition.id),
    getCurrentUser(),
  ])

  if (!release || release.status !== 'published') notFound()
  if (chapters.length === 0) notFound()

  // Серия нужна только разметке (`isPartOf`), поэтому берётся отдельно и не
  // блокирует основной круг запросов.
  const seriesLinks = await fetchReleaseSeries(release.id)
  const series = seriesLinks.length > 0 ? await fetchSeriesById(seriesLinks[0].series_id) : null

  const editionSlug = edition.slug || edition.id
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
        generateBreadcrumbSchema([
          { label: 'canfly', url: `${BASE_URL}/` },
          { label: 'Релизы', url: `${BASE_URL}${CATALOG_PATH}` },
          { label: release.title, url: `${BASE_URL}/release/${release.slug}` },
          {
            label: EDITION_FORMAT_LABELS[edition.format] ?? edition.format,
            url: `${BASE_URL}/vvvvv/${editionSlug}`,
          },
        ]),
      ]}
    />
  )

  if (edition.format === 'comic') {
    return (
      <>
        {jsonLd}
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
        <ReleaseAudioPlayer release={release} edition={edition} chapters={chapters} />
      </>
    )
  }

  if (edition.format !== 'book' && edition.format !== 'magazine') notFound()

  // Роли и прогресс чтения зависят только от user — тоже параллельно.
  const readerContext = user
    ? await Promise.all([getUserRoles(user.id), fetchReadingProgress(edition.id, user.id)])
    : null
  const roles: UserRole[] = readerContext?.[0] ?? []
  const progress = readerContext?.[1] ?? null

  const userRole: UserRole | null =
    (roles.find(role => ['editor', 'admin', 'author'].includes(role)) ?? roles[0] ?? null) as UserRole | null

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
      <SpreadReader
        release={release}
        edition={edition}
        chapters={chapters}
        initialChapterIndex={initialChapterIndex}
        currentUserId={user?.id ?? null}
        initialHighlights={initialHighlights}
        userRole={userRole}
        userName={user?.display_name ?? null}
      />
    </>
  )
}
