import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchSeriesWithReleases } from '@/lib/server/series'
import { SeriesPage } from '@/components/series-page'
import { generateBreadcrumbSchema, serializeJsonLd } from '@/lib/seo/schema'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const series = await fetchSeriesWithReleases(slug)
  if (!series) return { title: 'Серия не найдена | canfly' }

  const title = `${series.title} | canfly`
  const description = series.description ?? `Серия «${series.title}» на canfly`
  const url = `${BASE_URL}/series/${series.slug}`

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
    },
    alternates: { canonical: url },
  }
}

export default async function SeriesPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const series = await fetchSeriesWithReleases(slug)
  if (!series) notFound()

  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Релизы', url: `${BASE_URL}/releases/` },
    { label: series.title, url: `${BASE_URL}/series/${series.slug}` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <SeriesPage series={series} releases={series.releases} />
    </>
  )
}
