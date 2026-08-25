import { notFound, permanentRedirect, redirect } from 'next/navigation'
import Link from 'next/link'

import { CharacterProfileHero } from '@/components/character-profile-hero'
import { CharacterProfileSections } from '@/components/character-profile-sections'
import { CharacterReleasesSection } from '@/components/character-releases-section'
import { buildConstellationNodes } from '@/lib/character-constellation'
import {
  fetchCharacterBySlug,
  fetchCharacterFriends,
  fetchCharacterStats,
} from '@/lib/server/characters'
import { listVisibleCharacterPosts } from '@/lib/server/character-posts'
import { fetchWallPosts } from '@/lib/server/character-wall'
import { fetchReleasesByCharacter } from '@/lib/server/releases'
import { fetchSeriesByCharacter } from '@/lib/server/series'
import { fetchPlacesByCharacter } from '@/lib/server/places'
import { getCurrentUser } from '@/lib/server/session'
import { generateCharacterSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'

interface CharacterPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}

/** Прежние вкладки → якоря разделов на одной странице */
const LEGACY_TAB_ANCHOR: Record<string, string> = {
  feed: 'posts',
  about: 'about',
  relations: 'relations',
  wall: 'wall',
}

async function getCharacterData(slug: string) {
  try {
    return await fetchCharacterBySlug(slug)
  } catch (error) {
    console.error('Error fetching character:', error)
    return null
  }
}

export async function generateMetadata({ params }: CharacterPageProps) {
  const { slug } = await params
  const data = await getCharacterData(slug)
  if (!data?.character) return notFoundMetadata('Персонаж не найден')

  const { character } = data

  // Города теперь живут на отдельном маршруте /places
  if (character.character_type === 'city') {
    permanentRedirect(`/places/${character.slug}`)
  }

  return buildMetadata({
    title: `${character.name} - canfly | культура твоего сознания`,
    description:
      character.bio ??
      `Персонаж литературной вселенной canfly — ${character.name}.`,
    path: `/characters/${character.slug}`,
    generatedImage: true,
    ogType: 'profile',
  })
}

export default async function CharacterPage({ params, searchParams }: CharacterPageProps) {
  const { slug } = await params
  const { tab } = await searchParams
  const data = await getCharacterData(slug)
  if (!data?.character) notFound()

  // Города теперь живут на отдельном маршруте /places
  if (data.character.character_type === 'city') {
    permanentRedirect(`/places/${data.character.slug}`)
  }

  if (tab && LEGACY_TAB_ANCHOR[tab]) {
    redirect(`/characters/${slug}#${LEGACY_TAB_ANCHOR[tab]}`)
  }

  const [stats, friends, posts, wall, currentUser, subjectReleases, subjectSeries, characterPlaces] = await Promise.all([
    fetchCharacterStats(data.character.id),
    fetchCharacterFriends(data.character.id, 12),
    listVisibleCharacterPosts(data.character.slug),
    fetchWallPosts(data.character.id, { includeHidden: false, limit: 50 }),
    getCurrentUser(),
    fetchReleasesByCharacter(data.character.id, { onlyPublished: true }),
    fetchSeriesByCharacter(data.character.id),
    fetchPlacesByCharacter(data.character.id),
  ])

  const isAdmin = currentUser?.is_admin ?? false

  const subjectOfRefs = [
    ...subjectReleases.map(release => ({
      slug: release.release_slug,
      name: release.release_title,
      type: 'CreativeWork' as const,
    })),
    ...subjectSeries.map(series => ({
      slug: series.slug,
      name: series.title,
      type: 'CreativeWorkSeries' as const,
    })),
  ]

  const locationRefs = characterPlaces.map(p => ({
    slug: p.slug,
    name: p.name,
  }))

  const characterSchema = generateCharacterSchema(data.character, {
    subjectOf: subjectOfRefs,
    location: locationRefs,
  })

  return (
    <main className="relative mx-auto w-full max-w-3xl px-6 pb-32">
      <JsonLd schemas={[characterSchema]} />
      <div className="pt-4">
        <Breadcrumbs items={[
          { label: 'canfly', url: '/' },
          { label: 'Персонаж', url: '/characters' },
          { label: data.character.name, url: `/characters/${data.character.slug}` },
        ]} />
      </div>

      <CharacterProfileHero
        character={data.character}
        stats={stats}
        constellation={buildConstellationNodes({
          releases: subjectReleases,
          relationships: data.relationships ?? [],
          posts: posts,
        })}
      />

      {subjectReleases.some((rel) => rel.role === 'main') ? (
        <div className="cf-rise-late mt-12">
          <CharacterReleasesSection releases={subjectReleases} />
        </div>
      ) : null}

      <CharacterProfileSections
        slug={data.character.slug}
        character={data.character}
        relationships={data.relationships ?? []}
        posts={posts}
        friends={friends}
        wall={wall}
        currentUserId={currentUser?.id ?? null}
        isAdmin={isAdmin}
      />

      <div className="mt-24 text-center">
        <Link
          href="/characters"
          className="text-[11px] uppercase tracking-[0.28em] text-cf-text-4 transition-colors hover:text-cf-text-heading"
        >
          все герои
        </Link>
      </div>
    </main>
  )
}
