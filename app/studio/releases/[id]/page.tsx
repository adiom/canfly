import { notFound } from 'next/navigation'
import { dbQuery } from '@/lib/db'
import {
  getRelease,
  getEditions,
  getAllSeries,
  getReleaseSeries,
} from '@/lib/actions/studio'
import { fetchReleaseCharacters } from '@/lib/server/releases'
import { ReleasePageClient } from '@/components/studio/release-page-client'

export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [release, editions, series, releaseSeries, characters, releaseCharacters] = await Promise.all([
    getRelease(id),
    getEditions(id),
    getAllSeries(),
    getReleaseSeries(id),
    dbQuery<{ id: string; name: string; slug: string; avatar: string | null }>(
      'SELECT id, name, slug, avatar FROM characters ORDER BY name ASC',
    ),
    fetchReleaseCharacters(id),
  ])
  if (!release) notFound()

  return (
    <ReleasePageClient
      release={release}
      editions={editions}
      series={series}
      releaseSeries={releaseSeries}
      characters={characters}
      releaseCharacters={releaseCharacters}
    />
  )
}
