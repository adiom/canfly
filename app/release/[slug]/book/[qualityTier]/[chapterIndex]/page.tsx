import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchReleaseBySlug } from '@/lib/server/releases'
import { fetchEditionByReleaseFormatTier, fetchEditionsByRelease } from '@/lib/server/editions'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { fetchChapterHighlights } from '@/lib/server/chapter-highlights'
import type { UserRole } from '@/lib/types'
import { ReleaseBookReader } from '@/components/release-book-reader'
import { generateBookEditionSchema, generateBreadcrumbSchema, serializeJsonLd } from '@/lib/seo/schema'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const tierSuffixes: Record<string, string> = {
  draft: ' — черновик',
  standard: '',
  premium: ' — иллюстрированное издание',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; qualityTier: string; chapterIndex: string }>
}): Promise<Metadata> {
  const { slug, qualityTier, chapterIndex: ciStr } = await params
  const chapterNumber = parseInt(ciStr, 10)

  const release = await fetchReleaseBySlug(slug)
  if (!release) return { title: 'Не найдено | canfly' }

  const edition = await fetchEditionByReleaseFormatTier(release.id, 'book', qualityTier)
  if (!edition || edition.status !== 'published') return { title: 'Не найдено | canfly' }

  const chapters = await fetchPublishedChaptersByEdition(edition.id)
  const chapterIndex = chapterNumber - 1
  if (chapterIndex < 0 || chapterIndex >= chapters.length) return { title: 'Не найдено | canfly' }

  const chapter = chapters[chapterIndex]
  const suffix = tierSuffixes[qualityTier] ?? ''
  const title = `Глава ${chapterNumber} — ${release.title}${suffix} | canfly`
  const description = chapter.content?.slice(0, 160) ?? release.annotation ?? release.description ?? `«${release.title}» на canfly`
  const url = `${BASE_URL}/release/${release.slug}/book/${qualityTier}/${chapterNumber}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      locale: 'ru_RU',
      siteName: 'canfly',
      ...(release.cover_image && { images: [{ url: release.cover_image, width: 600, height: 900, alt: release.title }] }),
    },
    alternates: { canonical: url },
  }
}

export default async function ChapterPublicPage({
  params,
}: {
  params: Promise<{ slug: string; qualityTier: string; chapterIndex: string }>
}) {
  const { slug, qualityTier, chapterIndex: ciStr } = await params
  const chapterNumber = parseInt(ciStr, 10)
  const chapterIndex = chapterNumber - 1

  const release = await fetchReleaseBySlug(slug)
  if (!release || release.status !== 'published') notFound()

  const edition = await fetchEditionByReleaseFormatTier(release.id, 'book', qualityTier)
  if (!edition || edition.status !== 'published') notFound()

  const chapters = await fetchPublishedChaptersByEdition(edition.id)
  if (chapterIndex < 0 || chapterIndex >= chapters.length) notFound()

  const user = await getCurrentUser()
  const roles: UserRole[] = user ? await getUserRoles(user.id) : []
  const userRole = roles.find(r => ['editor', 'admin', 'author'].includes(r)) ?? (roles[0] ?? null)
  const highlights = await fetchChapterHighlights({
    chapterId: chapters[chapterIndex].id,
    currentUserId: user?.id ?? null,
  })

  const allEditions = await fetchEditionsByRelease(release.id)
  const otherBookEditions = allEditions.filter(
    e => e.format === 'book' && e.status === 'published' && e.id !== edition.id
  )

  // @id издания — оглавление, а не текущая глава: иначе одна сущность Book
  // получала бы разные @id со страницы оглавления и со страницы главы.
  const editionUrl = `${BASE_URL}/release/${release.slug}/book/${qualityTier}`
  const editionSchema = generateBookEditionSchema(release, edition, BASE_URL, editionUrl)
  const tierBreadcrumbLabel: Record<string, string> = {
    draft: 'Черновик',
    standard: 'Книга',
    premium: 'Иллюстрированная',
  }
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Релизы', url: `${BASE_URL}/releases/` },
    { label: release.title, url: `${BASE_URL}/release/${release.slug}` },
    { label: tierBreadcrumbLabel[qualityTier] ?? 'Книга', url: editionUrl },
    { label: `Глава ${chapterNumber}`, url: `${BASE_URL}/release/${release.slug}/book/${qualityTier}/${chapterNumber}` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(editionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
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
    </>
  )
}
