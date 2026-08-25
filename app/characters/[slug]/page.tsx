import { notFound, redirect } from 'next/navigation'
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
import { getCurrentUser } from '@/lib/server/session'
import { generateCharacterSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

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
  const isCity = character.character_type === 'city'

  return buildMetadata({
    title: `${character.name} - canfly | культура твоего сознания`,
    description:
      character.bio ??
      `${isCity ? 'Место' : 'Персонаж'} литературной вселенной canfly — ${character.name}.`,
    path: `/characters/${character.slug}`,
    // og:image — из opengraph-image.tsx рядом.
    generatedImage: true,
    // Город — не профиль человека; profile-теги (first_name/username) ему чужие.
    ogType: isCity ? 'website' : 'profile',
  })
}

export default async function CharacterPage({ params, searchParams }: CharacterPageProps) {
  const { slug } = await params
  // ?tab= из прежней версии профиля: вкладок больше нет, но старые ссылки
  // из индекса и переписок должны попадать на свой раздел.
  const { tab } = await searchParams
  const data = await getCharacterData(slug)
  if (!data?.character) notFound()

  if (tab && LEGACY_TAB_ANCHOR[tab]) {
    redirect(`/characters/${slug}#${LEGACY_TAB_ANCHOR[tab]}`)
  }

  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Персонажи', url: `${BASE_URL}/characters` },
    { label: data.character.name, url: `${BASE_URL}/characters/${data.character.slug}` },
  ])

  const [stats, friends, posts, wall, currentUser, subjectReleases, subjectSeries] = await Promise.all([
    fetchCharacterStats(data.character.id),
    fetchCharacterFriends(data.character.id, 12),
    listVisibleCharacterPosts(data.character.slug),
    fetchWallPosts(data.character.id, { includeHidden: false, limit: 50 }),
    getCurrentUser(),
    fetchReleasesByCharacter(data.character.id, { onlyPublished: true }),
    fetchSeriesByCharacter(data.character.id),
  ])

  const isAdmin = currentUser?.is_admin ?? false

  // subjectOf — все опубликованные релизы с участием персонажа + серии,
  // где у него role = 'main'. Дублей по @id не будет: уникальность по slug.
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

  const characterSchema = generateCharacterSchema(data.character, { subjectOf: subjectOfRefs })

  return (
    <main className="relative mx-auto w-full max-w-3xl px-6 pb-32">
      <JsonLd schemas={[characterSchema, breadcrumbSchema]} />
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

      {/* Нити орбитального поля тянутся именно к этим релизам — поэтому
          список стоит сразу под портретом, а не внизу страницы. */}
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
