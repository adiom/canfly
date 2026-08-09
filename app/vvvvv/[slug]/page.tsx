import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { fetchChapterHighlights } from '@/lib/server/chapter-highlights'
import { fetchReadingProgress } from '@/lib/server/reading-progress'
import { SpreadReader } from '@/components/spread-reader'
import { ReleaseComicReader } from '@/components/release-comic-reader'
import { ReleaseAudioPlayer } from '@/components/release-audio-player'
import type { UserRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const formatLabels: Record<string, string> = {
  book: 'Книга',
  magazine: 'Журнал',
  comic: 'Комикс',
  audiobook: 'Аудиокнига',
  audiorelease: 'Аудиорелиз',
  album: 'Альбом',
  digital: 'Цифровой релиз',
}

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

  if (!edition || edition.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }

  const release = await loadRelease(edition.release_id)
  if (!release || release.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }

  const title = `${release.title} — читать | canfly`
  const description =
    release.description ??
    release.annotation ??
    `«${release.title}» — ${(formatLabels[edition.format] ?? edition.format).toLowerCase()} на canfly`
  // Издание открывается и по UUID, и по слагу — канонический адрес один, по слагу.
  const url = `${BASE_URL}/vvvvv/${edition.slug || edition.id}`

  return {
    title,
    description,
    // Саму читалку не индексируем, но ссылки со страницы вес передают.
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      locale: 'ru_RU',
      siteName: 'canfly',
      ...(release.cover_image && {
        images: [{ url: release.cover_image, width: 600, height: 900, alt: release.title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(release.cover_image && { images: [release.cover_image] }),
    },
    alternates: { canonical: url },
  }
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

  if (edition.format === 'comic') {
    return <ReleaseComicReader release={release} edition={edition} chapters={chapters} />
  }

  if (
    edition.format === 'audiobook' ||
    edition.format === 'audiorelease' ||
    edition.format === 'album'
  ) {
    return <ReleaseAudioPlayer release={release} edition={edition} chapters={chapters} />
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
  )
}
