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
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapterIndex: string }>
}): Promise<Metadata> {
  const { slug, chapterIndex } = await params

  const edition = await loadScrollEdition(slug)
  if (!edition || edition.status !== 'published') return notFoundMetadata()

  const release = await loadScrollRelease(edition.release_id)
  if (!release || release.status !== 'published') return notFoundMetadata()

  return buildMetadata({
    title: `Глава ${chapterIndex} — ${release.title} — читать | canfly`,
    description: release.annotation ?? release.description ?? `«${release.title}» на canfly`,
    // Self-canonical при noindex: чужой canonical Google трактует как конфликт.
    path: `/scroll/${edition.slug || edition.id}/${chapterIndex}`,
    image: release.cover_image,
    imageAlt: release.title,
    ogType: 'article',
    // Читалка не дублирует SEO-страницы релиза и издания — индексации нет,
    // но ссылки со страницы обходить можно.
    noindex: true,
  })
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