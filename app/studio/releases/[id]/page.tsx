import { notFound } from 'next/navigation'
import { fetchReleaseById, fetchReleaseCharacters, fetchReleaseSeries } from '@/lib/server/releases'
import { fetchEditionsByRelease, fetchReleaseChapterCounts } from '@/lib/server/editions'
import { fetchAllSeries } from '@/lib/server/series'
import { fetchAllCharactersList } from '@/lib/server/characters'
import { fetchAllGames, fetchGamesByRelease } from '@/lib/server/games'
import { fetchAllPlaces, fetchPlacesByRelease } from '@/lib/server/places'
import { requireReleaseOwnership } from '@/lib/server/studio-auth'
import { getReleaseMetadata } from '@/lib/seo/release-metadata'
import { ReleasePageClient } from '@/components/studio/release-page-client'

export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session } = await requireReleaseOwnership(id)
  const release = await fetchReleaseById(id)
  if (!release) notFound()
  const [editions, chapterCounts, series, releaseSeries, characters, releaseCharacters, games, places, linkedGames, linkedPlaces] = await Promise.all([
    fetchEditionsByRelease(id),
    fetchReleaseChapterCounts(id),
    fetchAllSeries(),
    fetchReleaseSeries(id),
    fetchAllCharactersList(),
    fetchReleaseCharacters(id),
    session.isAdmin ? fetchAllGames() : [],
    session.isAdmin ? fetchAllPlaces() : [],
    fetchGamesByRelease(id, { onlyPublished: !session.isAdmin }),
    fetchPlacesByRelease(id),
  ])

  return (
    <ReleasePageClient
      key={release.id}
      release={release}
      editions={editions}
      series={series}
      releaseSeries={releaseSeries}
      characters={characters.map(({ id, name, slug, avatar }) => ({ id, name, slug, avatar: avatar ?? null }))}
      releaseCharacters={releaseCharacters}
      chapterCounts={chapterCounts}
      metadata={getReleaseMetadata(release)}
      world={{
        canEdit: session.isAdmin,
        games: (session.isAdmin ? games : linkedGames).map(game => ({ id: game.id, name: game.title, slug: game.slug, available: game.is_published })),
        places: (session.isAdmin ? places : linkedPlaces).map(place => ({ id: place.id, name: place.name, slug: place.slug, available: true })),
        linkedGameIds: linkedGames.map(game => game.id),
        linkedPlaceIds: linkedPlaces.map(place => place.id),
      }}
    />
  )
}
