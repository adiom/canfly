import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchSeriesWithReleases } from '@/lib/server/series'
import { SeriesPage } from '@/components/series-page'
import { generateBreadcrumbSchema, generateSeriesSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const series = await fetchSeriesWithReleases(slug)
  if (!series) return notFoundMetadata('Серия не найдена')

  return buildMetadata({
    title: `${series.title} | canfly`,
    description: series.description ?? `Серия «${series.title}» на canfly`,
    path: `/series/${series.slug}`,
    ogType: 'website',
    generatedImage: true,
  })
}

export default async function SeriesPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const series = await fetchSeriesWithReleases(slug)
  if (!series) notFound()

  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Серии', url: `${BASE_URL}/series` },
    { label: series.title, url: `${BASE_URL}/series/${series.slug}` },
  ])

  return (
    <>
      <JsonLd schemas={[generateSeriesSchema(series, series.releases), breadcrumbSchema]} />
      <SeriesPage
        series={series}
        releases={series.releases}
        breadcrumbs={[
          { label: 'canfly', url: '/' },
          { label: 'Серии', url: '/series' },
          { label: series.title, url: `/series/${series.slug}` },
        ]}
      />
    </>
  )
}
