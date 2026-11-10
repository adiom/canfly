import { relationshipLabel } from '@/lib/relationships-kinds'
import { resolveCharacterChatAvailability } from '@/lib/ai/character-chat/availability'
import {
  fetchPublicCharactersList,
  fetchRelationshipsForCharacters,
} from '@/lib/server/characters'
import { fetchEditionsByRelease, fetchReleaseChapterCounts } from '@/lib/server/editions'
import {
  fetchPlacesForCharacters,
  fetchPlacesForReleases,
  fetchPublicPlaces,
} from '@/lib/server/places'
import {
  fetchReleaseCharacters,
  fetchReleaseSeries,
  fetchReleasesWithEditions,
} from '@/lib/server/releases'
import { fetchAllSeriesWithStats } from '@/lib/server/series'
import type { Character, Place } from '@/lib/types'
import type { EditionFormat, ReleaseCharacterRole, ReleaseStatus } from '@/lib/releases-types'
import {
  EDITION_FORMAT_LABELS,
  canOpenEdition,
  getEditionAction,
} from '@/lib/utils/editions'

/**
 * Данные художественной главной `/v2`.
 *
 * Страница экспериментальная, но данные — настоящие: релизы, персонажи,
 * серии, места и связи читаются существующими репозиториями `lib/server/*`.
 * Здесь только отбор нужных slug'ов и сборка сцен; собственного SQL нет.
 *
 * Правила отбора:
 *  - показываются только `published`-релизы (draft/archived не попадают в сцену);
 *  - издание попадает в ссылку только если его реально можно открыть
 *    (`canOpenEdition`), чтобы на странице не было мёртвых CTA;
 *  - чат персонажа предлагается только при подтверждённой доступности
 *    (`resolveCharacterChatAvailability` — тот же resolver, что у API чата).
 */

export type V2NodeKind = 'release' | 'character' | 'series' | 'place'

export type V2EdgeKind = 'cast' | 'series' | 'relation' | 'place' | 'location'

export interface V2GraphNode {
  /** Стабильный id: `<kind>:<slug>` — по нему в компоненте лежит позиция. */
  id: string
  kind: V2NodeKind
  title: string
  description: string | null
  href: string
}

export interface V2GraphEdge {
  from: string
  to: string
  kind: V2EdgeKind
  /** Подпись связи для текстовой альтернативы: роль, тип отношения, роль места. */
  label: string
}

export interface V2Graph {
  nodes: V2GraphNode[]
  edges: V2GraphEdge[]
}

export interface V2CharacterCard {
  name: string
  slug: string
  avatar: string | null
  bio: string | null
  href: string
  /** Заполнен только когда чат реально может ответить. */
  chatHref: string | null
}

export interface V2FeaturedRelease {
  title: string
  slug: string
  href: string
  description: string | null
  cover: string | null
  genre: string | null
  /** Опубликованные форматы изданий — фактические, без draft. */
  formats: string[]
  series: { title: string; href: string; releaseCount: number } | null
}

export interface V2EditionLink {
  format: EditionFormat
  label: string
  action: string
  href: string
}

export interface V2MediaRelease {
  title: string
  slug: string
  href: string
  cover: string | null
  description: string | null
  /** Только издания, которые действительно открываются. */
  editions: V2EditionLink[]
}

export interface V2ExploreItem {
  title: string
  href: string
}

export interface V2PageData {
  featured: V2FeaturedRelease | null
  characters: V2CharacterCard[]
  graph: V2Graph
  media: V2MediaRelease | null
  explore: V2ExploreItem[]
}

/* Редакционный набор slug — композиция сцен. Названия, обложки, описания,
   статусы и связи приходят из БД, здесь только порядок появления. */
const FEATURED_RELEASE_SLUG = 'kroy-po-dushe'
const MEDIA_RELEASE_SLUG = 'ocean028'
const FEATURED_CHARACTER_SLUGS = ['sonya', 'Varvara', 'Mira']
const EXPLORE_RELEASE_SLUGS = ['bplr', 'human-curator', 'perevod-s-sobachego']

const GRAPH_RELEASE_SLUGS = [
  'kroy-po-dushe',
  'esche-odna-popytka-soni',
  'neuchtyonnaya-tom-1',
  'bplr',
]
const GRAPH_CHARACTER_SLUGS = ['sonya', 'Varvara', 'Mira', 'Maria']
const GRAPH_SERIES_SLUGS = ['kroy-po-dushe']
const GRAPH_PLACE_SLUGS = ['N']

const ROLE_LABELS: Record<ReleaseCharacterRole, string> = {
  main: 'главная роль',
  supporting: 'второстепенная роль',
  cameo: 'камео',
}

/** Сжатие описания для узла графа и карточки: одна строка, без потери смысла. */
function clip(text: string | null, max = 220): string | null {
  if (!text) return null
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const head = space > max * 0.6 ? cut.slice(0, space) : cut
  return `${head.trimEnd()}…`
}

function nodeId(kind: V2NodeKind, slug: string): string {
  return `${kind}:${slug}`
}

interface ReleaseRow {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image: string | null
  genre: string | null
  status: ReleaseStatus
  formats: EditionFormat[]
}

type CharacterRow = Character

export async function getV2PageData(): Promise<V2PageData> {
  const [releases, characters, series, places] = await Promise.all([
    fetchReleasesWithEditions({ status: 'published' }),
    fetchPublicCharactersList(),
    fetchAllSeriesWithStats(),
    fetchPublicPlaces(),
  ])

  const releaseBySlug = new Map<string, ReleaseRow>(
    releases.map((release) => [release.slug, release]),
  )
  const characterBySlug = new Map<string, CharacterRow>(
    characters.map((character) => [character.slug, character]),
  )

  const [featured, graph, media, explore] = await Promise.all([
    buildFeatured(releaseBySlug, series),
    buildGraph(releaseBySlug, characterBySlug, series, places),
    buildMedia(releaseBySlug),
    Promise.resolve(buildExplore(releaseBySlug)),
  ])

  const characterCards = buildCharacterCards(characterBySlug)

  return {
    featured,
    characters: characterCards,
    graph,
    media,
    explore,
  }
}

/* ── Scene 02 — выбранный релиз ─────────────────────────────────────────── */

async function buildFeatured(
  releaseBySlug: Map<string, ReleaseRow>,
  seriesList: Awaited<ReturnType<typeof fetchAllSeriesWithStats>>,
): Promise<V2FeaturedRelease | null> {
  const release = releaseBySlug.get(FEATURED_RELEASE_SLUG)
  if (!release) return null

  const [editions, seriesLinks] = await Promise.all([
    fetchEditionsByRelease(release.id),
    fetchReleaseSeries(release.id),
  ])

  const publishedFormats = new Set<EditionFormat>()
  for (const edition of editions) {
    if (edition.status === 'published') publishedFormats.add(edition.format)
  }

  const seriesLink = seriesLinks[0]
  const seriesInfo = seriesLink
    ? seriesList.find((item) => item.id === seriesLink.series_id)
    : undefined

  return {
    title: release.title,
    slug: release.slug,
    href: `/release/${release.slug}`,
    description: clip(release.description, 340),
    cover: release.cover_image,
    genre: release.genre,
    formats: [...publishedFormats].map((format) => EDITION_FORMAT_LABELS[format]),
    series: seriesInfo
      ? {
          title: seriesInfo.title,
          href: `/series/${seriesInfo.slug}`,
          releaseCount: seriesInfo.release_count,
        }
      : null,
  }
}

/* ── Scene 03 — персонажи ───────────────────────────────────────────────── */

function buildCharacterCards(
  characterBySlug: Map<string, CharacterRow>,
): V2CharacterCard[] {
  const cards: V2CharacterCard[] = []

  for (const slug of FEATURED_CHARACTER_SLUGS) {
    const character = characterBySlug.get(slug)
    if (!character || character.character_type !== 'person') continue

    // Тот же resolver, что у страницы чата и API: без готовности — без CTA.
    const availability = resolveCharacterChatAvailability({ character })

    cards.push({
      name: character.name,
      slug: character.slug,
      avatar: character.avatar,
      bio: clip(character.bio, 190),
      href: `/characters/${character.slug}`,
      chatHref: availability.canGenerate ? `/characters/${character.slug}/chat` : null,
    })
  }

  return cards
}

/* ── Scene 04 — карта связей ────────────────────────────────────────────── */

async function buildGraph(
  releaseBySlug: Map<string, ReleaseRow>,
  characterBySlug: Map<string, CharacterRow>,
  seriesList: Awaited<ReturnType<typeof fetchAllSeriesWithStats>>,
  placeList: Place[],
): Promise<V2Graph> {
  const releases = GRAPH_RELEASE_SLUGS
    .map((slug) => releaseBySlug.get(slug))
    .filter((release): release is ReleaseRow => Boolean(release))
  const graphCharacters = GRAPH_CHARACTER_SLUGS
    .map((slug) => characterBySlug.get(slug))
    .filter((character): character is CharacterRow => Boolean(character))
  const seriesItems = GRAPH_SERIES_SLUGS
    .map((slug) => seriesList.find((item) => item.slug === slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const placeItems = GRAPH_PLACE_SLUGS
    .map((slug) => placeList.find((place) => place.slug === slug))
    .filter((place): place is Place => Boolean(place))

  const nodes: V2GraphNode[] = [
    ...releases.map((release) => ({
      id: nodeId('release', release.slug),
      kind: 'release' as const,
      title: release.title,
      description: clip(release.description),
      href: `/release/${release.slug}`,
    })),
    ...graphCharacters.map((character) => ({
      id: nodeId('character', character.slug),
      kind: 'character' as const,
      title: character.name,
      description: clip(character.bio),
      href: `/characters/${character.slug}`,
    })),
    ...seriesItems.map((item) => ({
      id: nodeId('series', item.slug),
      kind: 'series' as const,
      title: item.title,
      description: clip(item.description),
      href: `/series/${item.slug}`,
    })),
    ...placeItems.map((place) => ({
      id: nodeId('place', place.slug),
      kind: 'place' as const,
      title: place.name,
      description: clip(place.bio),
      href: `/places/${place.slug}`,
    })),
  ]

  const nodeIds = new Set(nodes.map((node) => node.id))
  const releaseIds = releases.map((release) => release.id)
  const characterIds = graphCharacters.map((character) => character.id)
  const edges: V2GraphEdge[] = []
  const seen = new Set<string>()

  const pushEdge = (edge: V2GraphEdge) => {
    const key =
      edge.kind === 'relation'
        ? `relation:${[edge.from, edge.to].sort().join('|')}`
        : `${edge.kind}:${edge.from}:${edge.to}`
    if (seen.has(key)) return
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return
    seen.add(key)
    edges.push(edge)
  }

  const [castByRelease, seriesByRelease, relationships, characterPlaces, releasePlaces] =
    await Promise.all([
      Promise.all(releaseIds.map((id) => fetchReleaseCharacters(id))),
      Promise.all(releaseIds.map((id) => fetchReleaseSeries(id))),
      fetchRelationshipsForCharacters(characterIds),
      fetchPlacesForCharacters(characterIds),
      fetchPlacesForReleases(releaseIds),
    ])

  // Release → Character (role) и Release → Series — по каждому релизу графа.
  releases.forEach((release, index) => {
    const from = nodeId('release', release.slug)

    for (const link of castByRelease[index]) {
      const character = graphCharacters.find((item) => item.id === link.character_id)
      if (!character) continue
      pushEdge({
        from,
        to: nodeId('character', character.slug),
        kind: 'cast',
        label: ROLE_LABELS[link.role] ?? link.role,
      })
    }

    for (const link of seriesByRelease[index]) {
      const item = seriesItems.find((entry) => entry.id === link.series_id)
      if (!item) continue
      pushEdge({
        from,
        to: nodeId('series', item.slug),
        kind: 'series',
        label: 'входит в серию',
      })
    }
  })

  // Character → Character: в БД обе стороны пишутся отдельными строками,
  // поэтому пара дедуплицируется внутри pushEdge.
  for (const relation of relationships) {
    const from = graphCharacters.find((item) => item.id === relation.character_id)
    const to = graphCharacters.find((item) => item.id === relation.related_character_id)
    if (!from || !to || from.id === to.id) continue
    pushEdge({
      from: nodeId('character', from.slug),
      to: nodeId('character', to.slug),
      kind: 'relation',
      label: relationshipLabel(relation.relationship_type),
    })
  }

  // Character → Place и Release → Place.
  for (const link of characterPlaces) {
    const character = graphCharacters.find((item) => item.id === link.character_id)
    const place = placeItems.find((item) => item.id === link.id)
    if (!character || !place) continue
    pushEdge({
      from: nodeId('character', character.slug),
      to: nodeId('place', place.slug),
      kind: 'place',
      label: link.role === 'resident' ? 'живёт' : link.role,
    })
  }

  for (const link of releasePlaces) {
    const release = releases.find((item) => item.id === link.release_id)
    const place = placeItems.find((item) => item.id === link.id)
    if (!release || !place) continue
    pushEdge({
      from: nodeId('release', release.slug),
      to: nodeId('place', place.slug),
      kind: 'location',
      label: link.role || 'событие в месте',
    })
  }

  return { nodes, edges }
}

/* ── Scene 05 — мультимедийный релиз ────────────────────────────────────── */

async function buildMedia(
  releaseBySlug: Map<string, ReleaseRow>,
): Promise<V2MediaRelease | null> {
  const release = releaseBySlug.get(MEDIA_RELEASE_SLUG)
  if (!release) return null

  const [editions, chapterCounts] = await Promise.all([
    fetchEditionsByRelease(release.id),
    fetchReleaseChapterCounts(release.id),
  ])

  const openable = editions
    .filter((edition) => canOpenEdition(edition, chapterCounts[edition.id] ?? 0))
    .map((edition) => ({
      format: edition.format,
      label: EDITION_FORMAT_LABELS[edition.format],
      action: getEditionAction(edition),
      href: `/vvvvv/${edition.slug}`,
    }))

  // Без единого открытого издания сцена не имеет честного содержания.
  if (openable.length === 0) return null

  return {
    title: release.title,
    slug: release.slug,
    href: `/release/${release.slug}`,
    cover: release.cover_image,
    description: clip(release.description, 300),
    editions: openable,
  }
}

/* ── Scene 05 / more — продолжение exploration ──────────────────────────── */

function buildExplore(
  releaseBySlug: Map<string, ReleaseRow>,
): V2ExploreItem[] {
  return EXPLORE_RELEASE_SLUGS.flatMap((slug) => {
    const release = releaseBySlug.get(slug)
    if (!release) return []
    return [{ title: release.title, href: `/release/${release.slug}` }]
  })
}
