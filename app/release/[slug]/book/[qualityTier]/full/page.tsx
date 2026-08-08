import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchReleaseBySlug } from '@/lib/server/releases'
import { fetchEditionByReleaseFormatTier } from '@/lib/server/editions'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { ReleaseFullPage } from '@/components/release-full-page'
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
  params: Promise<{ slug: string; qualityTier: string }>
}): Promise<Metadata> {
  const { slug, qualityTier } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release) return { title: 'Не найдено | canfly' }

  const edition = await fetchEditionByReleaseFormatTier(release.id, 'book', qualityTier)
  if (!edition || edition.status !== 'published') return { title: 'Не найдено | canfly' }

  const suffix = tierSuffixes[qualityTier] ?? ''
  const title = `${release.title} (полная версия)${suffix} | canfly`
  const description = release.annotation ?? release.description ?? `«${release.title}» — полная версия на canfly`
  const url = `${BASE_URL}/release/${release.slug}/book/${qualityTier}/full`

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
      ...(release.cover_image && { images: [{ url: release.cover_image, width: 600, height: 900, alt: release.title }] }),
    },
    alternates: { canonical: url },
  }
}

export default async function EditionFullPage({
  params,
}: {
  params: Promise<{ slug: string; qualityTier: string }>
}) {
  const { slug, qualityTier } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release || release.status !== 'published') notFound()

  const edition = await fetchEditionByReleaseFormatTier(release.id, 'book', qualityTier)
  if (!edition || edition.status !== 'published') notFound()

  const chapters = await fetchPublishedChaptersByEdition(edition.id)
  if (chapters.length === 0) notFound()

  const editionSchema = generateBookEditionSchema(release, edition, BASE_URL)
  const tierBreadcrumbLabel: Record<string, string> = {
    draft: 'Черновик',
    standard: 'Книга',
    premium: 'Иллюстрированная',
  }
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Релизы', url: `${BASE_URL}/releases/` },
    { label: release.title, url: `${BASE_URL}/release/${release.slug}` },
    { label: tierBreadcrumbLabel[qualityTier] ?? 'Книга', url: `${BASE_URL}/release/${release.slug}/book/${qualityTier}/full` },
    { label: 'Полная версия', url: `${BASE_URL}/release/${release.slug}/book/${qualityTier}/full` },
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
      <ReleaseFullPage release={release} edition={edition} chapters={chapters} />
    </>
  )
}
