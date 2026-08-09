import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchReleaseBySlug } from '@/lib/server/releases'
import { fetchEditionByReleaseFormatTier, fetchEditionsByRelease } from '@/lib/server/editions'
import { fetchPublishedChapterListByEdition } from '@/lib/server/chapters'
import { fetchPublicHighlightsByRelease } from '@/lib/server/chapter-highlights'
import { fetchEditionProgressMap, fetchReadingProgress } from '@/lib/server/reading-progress'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { ReleaseEditionToc, type EditionResume } from '@/components/release-edition-toc'
import { computeEditionMeta, getChapterUrl } from '@/lib/utils/editions'
import {
  generateBookEditionSchema,
  generateBreadcrumbSchema,
  generateChapterListSchema,
  serializeJsonLd,
} from '@/lib/seo/schema'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const tierSuffixes: Record<string, string> = {
  draft: ' — черновик',
  standard: '',
  premium: ' — иллюстрированное издание',
}

const tierBreadcrumbLabels: Record<string, string> = {
  draft: 'Черновик',
  standard: 'Книга',
  premium: 'Иллюстрированная',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; qualityTier: string }>
}): Promise<Metadata> {
  const { slug, qualityTier } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release) return { title: 'Не найдено | canfly' }

  const edition = await fetchEditionByReleaseFormatTier(release.id, 'book', qualityTier)
  if (!edition || edition.status !== 'published') return { title: 'Не найдено | canfly' }
  const suffix = tierSuffixes[qualityTier] ?? ''
  const title = `${release.title}${suffix} | canfly`
  const description = release.description ?? undefined
  const url = `${BASE_URL}/release/${release.slug}/book/${qualityTier}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'book',
      locale: 'ru_RU',
      siteName: 'canfly',
      ...(release.cover_image && {
        images: [{ url: release.cover_image, width: 600, height: 900, alt: release.title }],
      }),
    },
    alternates: { canonical: url },
  }
}

export default async function EditionPublicPage({
  params,
}: {
  params: Promise<{ slug: string; qualityTier: string }>
}) {
  const { slug, qualityTier } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release || release.status !== 'published') notFound()

  const edition = await fetchEditionByReleaseFormatTier(release.id, 'book', qualityTier)
  if (!edition || edition.status !== 'published') notFound()

  const chapters = await fetchPublishedChapterListByEdition(edition.id)

  if (chapters.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cf-text-3">
        Содержимое ещё не опубликовано
      </div>
    )
  }

  const user = await getCurrentUser()
  const [allEditions, highlights, roles, progress, progressByChapter] = await Promise.all([
    fetchEditionsByRelease(release.id),
    fetchPublicHighlightsByRelease(release.id, 4),
    user ? getUserRoles(user.id) : Promise.resolve([]),
    user ? fetchReadingProgress(edition.id, user.id) : Promise.resolve(null),
    user ? fetchEditionProgressMap(edition.id, user.id) : Promise.resolve({}),
  ])

  const otherEditions = allEditions.filter(e => e.status === 'published' && e.id !== edition.id)

  let resume: EditionResume | null = null
  if (progress) {
    const index = chapters.findIndex(c => c.id === progress.chapter_id)
    const percent = Number(progress.progress_percent)
    // Дочитанную последнюю главу возобновлять незачем — это конец книги.
    const isFinished = index === chapters.length - 1 && percent >= 95
    if (index >= 0 && !isFinished) {
      resume = {
        chapterNumber: index + 1,
        chapterTitle: chapters[index].title,
        percent: Math.round(percent),
      }
    }
  }

  const editionUrl = `${BASE_URL}/release/${release.slug}/book/${qualityTier}`
  const editionSchema = generateBookEditionSchema(release, edition, BASE_URL, editionUrl)
  const chapterListSchema = generateChapterListSchema(
    chapters.map((chapter, index) => ({
      title: chapter.title,
      url: `${BASE_URL}${getChapterUrl(release.slug, edition, index + 1)}`,
    })),
    editionUrl,
  )
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Релизы', url: `${BASE_URL}/releases/` },
    { label: release.title, url: `${BASE_URL}/release/${release.slug}` },
    { label: tierBreadcrumbLabels[qualityTier] ?? 'Книга', url: editionUrl },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(editionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(chapterListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <ReleaseEditionToc
        release={release}
        edition={edition}
        chapters={chapters}
        otherEditions={otherEditions}
        highlights={highlights}
        meta={computeEditionMeta(chapters)}
        resume={resume}
        progressByChapter={progressByChapter}
        isAdmin={roles.includes('admin')}
      />
    </>
  )
}
