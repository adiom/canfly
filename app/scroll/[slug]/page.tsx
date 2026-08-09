import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/server/session'
import {
  loadScrollEdition,
  loadScrollRelease,
  loadScrollChapters,
  getScrollResumeIndex,
} from '@/lib/server/scroll-reader'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const edition = await loadScrollEdition(slug)
  if (!edition || edition.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }
  const release = await loadScrollRelease(edition.release_id)
  if (!release || release.status !== 'published') {
    return { title: 'Не найдено | canfly', robots: { index: false, follow: false } }
  }
  const url = `${BASE_URL}/scroll/${edition.slug || edition.id}`
  return {
    title: `${release.title} — читать | canfly`,
    description: release.description ?? release.annotation ?? `«${release.title}» на canfly`,
    robots: { index: false, follow: true },
    alternates: { canonical: url },
  }
}

/**
 * Вход в скролл-читалку без номера главы: продолжаем с места из прогресса
 * (или с первой главы) и делаем 307 на `/scroll/[slug]/[chapterIndex]` —
 * дальше работает обычный ридер, аго глава уже в каноническом адресе.
 */
export default async function ScrollReaderBasePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const edition = await loadScrollEdition(slug)
  if (!edition || edition.status !== 'published') notFound()

  const [release, chapters, user] = await Promise.all([
    loadScrollRelease(edition.release_id),
    loadScrollChapters(edition.id),
    getCurrentUser(),
  ])
  if (!release || release.status !== 'published') notFound()
  if (chapters.length === 0) notFound()

  const resumeIndex = await getScrollResumeIndex(edition.id, user?.id ?? null, chapters)
  redirect(`/scroll/${edition.slug || edition.id}/${resumeIndex + 1}`)
}