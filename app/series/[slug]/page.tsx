import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cache } from 'react'
import { fetchSeriesWithReleases } from '@/lib/server/series'
import { SeriesPage } from '@/components/series-page'
import { generateSeriesSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'

// Reuse the same database read for metadata and page within one React request.
const loadSeries = cache(fetchSeriesWithReleases)

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const series = await loadSeries(slug)
  if (!series) return notFoundMetadata('Серия не найдена')

  return buildMetadata({
    title: `Серия книг: ${series.title} | canfly`,
    description: series.description ?? `Серия «${series.title}» на canfly`,
    path: `/series/${series.slug}`,
    ogType: 'website',
    generatedImage: true,
  })
}

export default async function SeriesPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const series = await loadSeries(slug)
  if (!series) notFound()

  return (
    <>
      <JsonLd schemas={[generateSeriesSchema(series, series.releases)]} />
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
