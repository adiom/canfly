import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import { cache } from 'react'

import { CharacterGamesSection } from '@/components/character-games-section'
import { CharacterProfileHero } from '@/components/character-profile-hero'
import { CharacterProfileSections } from '@/components/character-profile-sections'
import { CharacterReleasesSection } from '@/components/character-releases-section'
import { buildConstellationNodes } from '@/lib/character-constellation'
import {
  fetchCharacterBySlug,
  fetchCharacterFriends,
  fetchCharacterStats,
  fetchPublicCharactersList,
} from '@/lib/server/characters'
import { listVisibleCharacterPosts } from '@/lib/server/character-posts'
import { fetchWallPosts } from '@/lib/server/character-wall'
import { fetchReleasesByCharacter } from '@/lib/server/releases'
import { fetchSeriesByCharacter } from '@/lib/server/series'
import { fetchGamesByCharacter } from '@/lib/server/games'
import { fetchPlacesByCharacter } from '@/lib/server/places'
import { generateCharacterSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'

interface CharacterPageProps {
  params: Promise<{ slug: string }>
}

/*
 * `generateMetadata` и рендер страницы выполняются в одном запросе, поэтому
 * React `cache()` убирает повторные походы в БД: профиль персонажа и его серии
 * нужны и для `<title>`, и для разметки.
 */
const getCharacterData = cache(async (slug: string) => {
  try {
    return await fetchCharacterBySlug(slug)
  } catch (error) {
    console.error('Error fetching character:', error)
    return null
  }
})

const getCharacterSeries = cache(async (characterId: string) => {
  try {
    return await fetchSeriesByCharacter(characterId)
  } catch (error) {
    console.error('Error fetching character series:', error)
    return []
  }
})

/*
 * Профиль больше не читает cookies и searchParams, поэтому может жить в ISR:
 * записи и стена приходят публичными запросами, а персональные элементы
 * (кнопка дружбы, удаление своей записи на стене) читают сессию на клиенте.
 * 5 минут — компромисс между свежестью и TTFB; мутации дополнительно зовут
 * revalidatePath, поэтому правки видны сразу.
 */
export const revalidate = 300

/** Список для сборки: профили людей. Города редиректят на /places. */
export async function generateStaticParams() {
  try {
    const characters = await fetchPublicCharactersList()
    return characters
      .filter(character => character.character_type === 'person')
      .map(character => ({ slug: character.slug }))
  } catch (error) {
    // Без БД на этапе сборки страницы сгенерируются по требованию.
    console.error('Error building character params:', error)
    return []
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

  /*
   * Заголовок собирается из имени и серии, где персонаж главный герой.
   * Прежний `${name} - canfly | культура твоего сознания` тратил половину
   * сниппета на слоган и не отвечал на запросы вида «Соня Крой по душе».
   */
  const series = await getCharacterSeries(character.id)
  const primarySeries = series[0]
  const seriesContext = primarySeries ? ` из серии «${primarySeries.title}»` : ''

  /*
   * Короткий `bio` (у части героев — 42–60 символов) не заполняет сниппет,
   * поэтому при длинном `full_description` берём его: buildMetadata снимет
   * разметку и обрежет до 155 символов по границе слова.
   */
  const bio = character.bio?.trim() || null
  const fullDescription = character.full_description?.trim() || null
  let description = bio ?? fullDescription
  if (
    fullDescription &&
    (!bio || bio.length < 100) &&
    fullDescription.length > (bio?.length ?? 0)
  ) {
    description = fullDescription
  }

  return buildMetadata({
    title: `${character.name} — персонаж canfly${seriesContext}`,
    description:
      description ??
      `Персонаж литературной вселенной canfly — ${character.name}. Биография, связи и записи героя.`,
    path: `/characters/${character.slug}`,
    generatedImage: true,
    ogType: 'profile',
  })
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { slug } = await params
  const data = await getCharacterData(slug)
  if (!data?.character) notFound()

  // Города теперь живут на отдельном маршруте /places
  if (data.character.character_type === 'city') {
    permanentRedirect(`/places/${data.character.slug}`)
  }

  // Регистр в URL — не часть идентичности: /characters/Sonya ведёт на сохранённый слаг.
  if (data.character.slug !== slug) {
    permanentRedirect(`/characters/${data.character.slug}`)
  }

  const [stats, friends, posts, wall, subjectReleases, subjectSeries, characterPlaces, games] = await Promise.all([
    fetchCharacterStats(data.character.id),
    fetchCharacterFriends(data.character.id, 12),
    listVisibleCharacterPosts(data.character.slug),
    fetchWallPosts(data.character.id, { includeHidden: false, limit: 50 }),
    fetchReleasesByCharacter(data.character.id, { onlyPublished: true }),
    getCharacterSeries(data.character.id),
    fetchPlacesByCharacter(data.character.id),
    fetchGamesByCharacter(data.character.id),
  ])

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
          { label: 'Персонажи', url: '/characters' },
          { label: data.character.name, url: `/characters/${data.character.slug}` },
        ]} />
      </div>

      <CharacterProfileHero
        character={data.character}
        stats={stats}
        places={characterPlaces}
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

      {games.length > 0 ? (
        <div className="cf-rise-late mt-16">
          <CharacterGamesSection games={games} />
        </div>
      ) : null}

      <CharacterProfileSections
        slug={data.character.slug}
        character={data.character}
        relationships={data.relationships ?? []}
        posts={posts}
        friends={friends}
        wall={wall}
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
