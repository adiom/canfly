import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { fetchEditionsByRelease } from '@/lib/server/editions'
import { fetchChapterHighlights } from '@/lib/server/chapter-highlights'
import { isAudioFormat } from '@/lib/utils/editions'
import { ReleaseBookReader } from '@/components/release-book-reader'
import type { UserRole } from '@/lib/types'
import {
  loadScrollEdition,
  loadScrollRelease,
  loadScrollChapters,
} from '@/lib/server/scroll-reader'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapterIndex: string }>
}): Promise<Metadata> {
  const { slug, chapterIndex } = await params

  const edition = await loadScrollEdition(slug)
  if (!edition || edition.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }
  const release = await loadScrollRelease(edition.release_id)
  if (!release || release.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }

  const url = `${BASE_URL}/scroll/${edition.slug || edition.id}/${chapterIndex}`
  return {
    title: `Глава ${chapterIndex} — ${release.title} — читать | canfly`,
description: release.description ?? release.annotation ?? `«${release.title}» на canfly`,
    // Читалка не дублирует SEO-страницы релиза — индексации нет.
    robots: { index: false, follow: true },
    alternates: { canonical: url },
  }
}

/**
 * Скролл-читалка издания по слагу (или UUID) с номером главы в URL.
 * book/magazine → ReleaseBookReader; комиксы и аудио живут в `/vvvvv`.
 */
export default async function ScrollReaderChapterPage({
  params,
}: {
  params: Promise<{ slug: string; chapterIndex: string }>
}) {
  const { slug, chapterIndex: ciStr } = await params
  const chapterNumber = parseInt(ciStr, 10)

  const edition = await loadScrollEdition(slug)
  if (!edition || edition.status !== 'published') notFound()

  // Релиз, главы и пользователь друг от друга не зависят — один круг вместо трёх.
  const [release, chapters, user] = await Promise.all([
    loadScrollRelease(edition.release_id),
    loadScrollChapters(edition.id),
    getCurrentUser(),
  ])
  if (!release || release.status !== 'published') notFound()
  if (chapters.length === 0) notFound()

  // Не-книжные форматы в скролл-читалке не рендерятся.
  if (edition.format !== 'book' && edition.format !== 'magazine') {
    if (edition.format === 'comic' || isAudioFormat(edition.format)) {
      redirect(`/vvvvv/${edition.slug || edition.id}`)
    }
    redirect(`/release/${release.slug}`)
  }

  const chapterIndex = chapterNumber - 1
  if (!Number.isInteger(chapterNumber) || chapterIndex < 0 || chapterIndex >= chapters.length) {
    notFound()
  }

  // Роли зависят только от user — тоже параллельно.
  const roles: UserRole[] = user ? await getUserRoles(user.id) : []
  const userRole: UserRole | null =
    (roles.find(role => ['editor', 'admin', 'author'].includes(role)) ?? roles[0] ?? null) as UserRole | null

  const highlights = await fetchChapterHighlights({
    chapterId: chapters[chapterIndex].id,
    currentUserId: user?.id ?? null,
  })

  const allEditions = await fetchEditionsByRelease(release.id)
  const otherBookEditions = allEditions.filter(
    e => e.format === 'book' && e.status === 'published' && e.id !== edition.id,
  )

  return (
    <ReleaseBookReader
      release={release}
      edition={edition}
      chapters={chapters}
      initialChapterIndex={chapterIndex}
      currentUserId={user?.id ?? null}
      initialHighlights={highlights}
      userRole={userRole}
      userName={user?.display_name ?? null}
      otherBookEditions={otherBookEditions}
    />
  )
}