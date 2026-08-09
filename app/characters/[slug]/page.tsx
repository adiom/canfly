import { notFound } from 'next/navigation'
import Link from 'next/link'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { CharacterProfileHeader } from '@/components/character-profile-header'
import { CharacterProfileTabs } from '@/components/character-profile-tabs'
import {
  fetchCharacterBySlug,
  fetchCharacterFriends,
  fetchCharacterStats,
} from '@/lib/server/characters'
import { listVisibleCharacterPosts } from '@/lib/server/character-posts'
import { fetchWallPosts } from '@/lib/server/character-wall'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { generateCharacterSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

interface CharacterPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
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

const VALID_TABS = ['feed', 'about', 'relations', 'wall'] as const
type Tab = (typeof VALID_TABS)[number]

function normalizeTab(value: string | undefined): Tab {
  return VALID_TABS.includes(value as Tab) ? (value as Tab) : 'feed'
}

export default async function CharacterPage({ params, searchParams }: CharacterPageProps) {
  const { slug } = await params
  const { tab } = await searchParams
  const data = await getCharacterData(slug)
  if (!data?.character) notFound()

  const activeTab = normalizeTab(tab)

  const characterSchema = generateCharacterSchema(data.character)
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Персонажи', url: `${BASE_URL}/characters` },
    { label: data.character.name, url: `${BASE_URL}/characters/${data.character.slug}` },
  ])

  const [stats, friends, posts, wall, currentUser] = await Promise.all([
    fetchCharacterStats(data.character.id),
    fetchCharacterFriends(data.character.id, 12),
    listVisibleCharacterPosts(data.character.slug),
    fetchWallPosts(data.character.id, { includeHidden: false, limit: 50 }),
    getCurrentUser(),
  ])

  const isAdmin = currentUser
    ? (await getUserRoles(currentUser.id)).includes('admin')
    : false

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <JsonLd schemas={[characterSchema, breadcrumbSchema]} />
      <SiteHeader activePath="/characters" />

      <section className="max-w-5xl mx-auto px-4 md:px-8 py-12">
        <div className="mb-6">
          <Link
            href="/characters"
            className="text-xs font-black uppercase tracking-[0.18em] text-cf-text-3 hover:text-cf-text-heading transition-colors"
          >
            ← Персонажи
          </Link>
        </div>

        <CharacterProfileHeader character={data.character} stats={stats} />

        <CharacterProfileTabs
          slug={data.character.slug}
          activeTab={activeTab}
          character={data.character}
          relationships={data.relationships ?? []}
          posts={posts}
          friends={friends}
          wall={wall}
          currentUserId={currentUser?.id ?? null}
          isAdmin={isAdmin}
        />
      </section>

      <SiteFooter />
    </main>
  )
}
