import { notFound } from 'next/navigation'
import { getRelease, getEditions, getAllSeries, getReleaseSeries } from '@/lib/actions/studio'
import { ReleasePageClient } from '@/components/studio/release-page-client'

export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [release, editions, series, releaseSeries] = await Promise.all([
    getRelease(id),
    getEditions(id),
    getAllSeries(),
    getReleaseSeries(id),
  ])
  if (!release) notFound()

  return (
    <ReleasePageClient
      release={release}
      editions={editions}
      series={series}
      releaseSeries={releaseSeries}
    />
  )
}
