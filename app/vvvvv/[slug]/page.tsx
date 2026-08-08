import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchEditionById } from '@/lib/server/editions'
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

const formatLabels: Record<string, string> = {
  book: 'Книга',
  magazine: 'Журнал',
  comic: 'Комикс',
  audiobook: 'Аудиокнига',
  audiorelease: 'Аудиорелиз',
  album: 'Альбом',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const edition = await fetchEditionById(slug)

  if (!edition || edition.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }

  const release = await fetchReleaseById(edition.release_id)
  if (!release || release.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }

  return {
    title: `${release.title} — A/B reader | canfly`,
    description: `Экспериментальная читалка: ${formatLabels[edition.format] ?? edition.format}.`,
    robots: { index: false, follow: false },
  }
}

export default async function VvvvvReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const edition = await fetchEditionById(slug)
  if (!edition || edition.status !== 'published') notFound()

  const release = await fetchReleaseById(edition.release_id)
  if (!release || release.status !== 'published') notFound()

  const chapters = await fetchPublishedChaptersByEdition(edition.id)
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

  const user = await getCurrentUser()
  const roles = user ? await getUserRoles(user.id) : []
  const userRole: UserRole | null =
    (roles.find(role => ['editor', 'admin', 'author'].includes(role)) ?? roles[0] ?? null) as UserRole | null

  const progress = user ? await fetchReadingProgress(edition.id, user.id) : null
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
