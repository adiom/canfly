import type {
  Release,
  Edition,
  EditionFormat,
  Chapter,
  Series,
  ChapterHighlight,
} from '@/lib/releases-types'
import type { Character, NewsPost, UserProfile } from '@/lib/types'
import type { SeriesRelease } from '@/lib/server/series'
import type { EditionMeta } from '@/lib/utils/editions'
import { stripHtml, truncate } from '@/lib/seo/metadata'
import {
  BASE_URL,
  ID,
  ref,
  imageObject,
  editionUrl,
  editionSchemaType,
  isAudioSchemaType,
  toISO8601Duration,
  toISODate,
  organizationNode,
  websiteNode,
  QUALITY_TIER_EDITION_LABELS,
} from '@/lib/seo/entities'

export { serializeJsonLd } from '@/lib/seo/serialize'
export { organizationNode, authorNode, websiteNode, BASE_URL, ID } from '@/lib/seo/entities'

// === Общее ===

export function generateBreadcrumbSchema(items: Array<{ label: string; url: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: item.url,
    })),
  }
}

export interface CollectionItem {
  name: string
  url: string
  image?: string | null
}

/**
 * `CollectionPage` + `ItemList` для каталогов. Без него листинги выглядят для
 * поисковика как страницы без структуры — связь с карточками не читается.
 */
export function generateCollectionSchema(opts: {
  name: string
  description: string
  path: string
  items: CollectionItem[]
  /** Общее число элементов, если на странице показана только часть. */
  totalItems?: number
}) {
  const url = `${BASE_URL}${opts.path}`

  return {
    '@type': 'CollectionPage',
    '@id': url,
    name: opts.name,
    description: truncate(stripHtml(opts.description)),
    url,
    inLanguage: 'ru-RU',
    isPartOf: ref(ID.website),
    publisher: ref(ID.organization),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.totalItems ?? opts.items.length,
      itemListElement: opts.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
        ...(item.image && { image: item.image }),
      })),
    },
  }
}

// === Релиз (произведение) ===

/**
 * Авторы из БД, с откатом на канонического автора вселенной.
 *
 * Раньше `author` был захардкожен всегда — `releases.authors` игнорировался,
 * поэтому соавторы в разметку не попадали.
 */
function releaseAuthors(release: Release) {
  if (!release.authors || release.authors.length === 0) return ref(ID.author)

  const authors = release.authors
    .filter(author => author?.name)
    .map(author => ({
      '@type': 'Person',
      name: author.name,
      ...(author.role && { jobTitle: author.role }),
    }))

  return authors.length > 0 ? authors : ref(ID.author)
}

/**
 * Одно издание внутри `workExample` произведения.
 *
 * Тип берётся из карты форматов, а не фиксируется как `Book`: комиксы,
 * аудиокниги, журналы и альбомы иначе не размечались вообще.
 */
function editionExample(
  edition: Edition,
  release: Release,
  meta?: EditionMeta,
): Record<string, unknown> {
  const spec = editionSchemaType(edition.format)
  const url = editionUrl(edition.slug || edition.id)
  const tierLabel = QUALITY_TIER_EDITION_LABELS[edition.quality_tier]
  const isAudio = isAudioSchemaType(spec.type)

  return {
    '@type': spec.type,
    '@id': ID.edition(edition.slug || edition.id),
    name: tierLabel ? `${release.title} — ${tierLabel.toLowerCase()}` : release.title,
    url,
    inLanguage: 'ru-RU',
    isAccessibleForFree: true,
    ...(spec.bookFormat && { bookFormat: spec.bookFormat }),
    ...(edition.format === 'book' && tierLabel && { bookEdition: tierLabel }),
    // isbn — свойство Book, не CreativeWork: на произведении он был невалиден.
    ...(edition.format === 'book' && release.isbn && { isbn: release.isbn }),
    ...(edition.external_url && { sameAs: edition.external_url }),
    ...(meta && meta.chapterCount > 0 && { numberOfPages: meta.chapterCount }),
    ...(meta && !isAudio && meta.wordCount > 0 && { wordCount: meta.wordCount }),
    ...(meta &&
      !isAudio &&
      meta.readingMinutes > 0 && { timeRequired: `PT${meta.readingMinutes}M` }),
    ...(meta &&
      isAudio && { duration: toISO8601Duration(meta.durationSeconds) }),
    author: releaseAuthors(release),
    publisher: ref(ID.organization),
    potentialAction: {
      '@type': isAudio ? 'ListenAction' : 'ReadAction',
      target: { '@type': 'EntryPoint', urlTemplate: url },
    },
  }
}

function releaseGenres(formats: EditionFormat[], genre: string | null): string[] {
  const genres: string[] = ['Fiction', 'Contemporary Fiction']
  if (formats.includes('comic')) genres.push('Comics & Graphic Novels')
  if (genre && !genres.includes(genre)) genres.push(genre)
  return genres
}

/**
 * Произведение остаётся `CreativeWork` — это абстракция над изданиями.
 * Конкретные типы (`Book`, `ComicIssue`, `Audiobook`, …) живут в `workExample`
 * и на собственных страницах изданий.
 *
 * Связи с персонажами:
 * - `character` — ВСЕ привязанные (главные и второстепенные), как массив @id-ссылок;
 * - `about` — главный герой (`role = 'main'`), как полный @id-ссылка.
 * Без разделения поисковик не понимает, кто ведёт сюжет, а кто эпизодичен.
 */
export function generateReleaseSchema(opts: {
  release: Release
  editions: Edition[]
  formats: EditionFormat[]
  characters?: Array<Pick<Character, 'name' | 'slug' | 'avatar' | 'character_type'>>
  /** Роли каждого персонажа в релизе (`main`/`supporting`/`cameo`). */
  characterRoles?: Map<string, string>
  series?: { slug: string; title: string } | null
  /** Агрегаты основного издания — страницы, слова, длительность. */
  primaryMeta?: EditionMeta
  primaryEditionId?: string | null
}) {
  const { release, editions, formats, characters, characterRoles, series, primaryMeta, primaryEditionId } = opts
  const url = `${BASE_URL}/release/${release.slug}`

  const published = editions.filter(edition => edition.status === 'published')
  const workExample = published.map(edition =>
    editionExample(
      edition,
      release,
      primaryEditionId && edition.id === primaryEditionId ? primaryMeta : undefined,
    ),
  )

  // Сборка character/mentions/about из единого списка. role хранится в Map,
  // чтобы не менять сигнатуру characterNode.
  const persons: Array<Record<string, unknown>> = []
  const cities: Array<Record<string, unknown>> = []

  if (characters && characters.length > 0) {
    for (const character of characters) {
      const isCity = character.character_type === 'city'
      const node: Record<string, unknown> = {
        '@type': isCity ? 'Place' : 'Person',
        '@id': ID.character(character.slug, isCity ? 'city' : 'person'),
        name: character.name,
        url: `${BASE_URL}/characters/${character.slug}`,
        image: imageObject(character.avatar),
      }
      if (isCity) cities.push(node)
      else persons.push(node)
    }
  }

  const protagonist =
    characters && characterRoles
      ? characters.find(
          character => characterRoles.get(character.slug) === 'main',
        ) ?? null
      : null

  const protagonistNode = protagonist
    ? (() => {
        const isCity = protagonist.character_type === 'city'
        return {
          '@type': isCity ? 'Place' : 'Person',
          '@id': ID.character(protagonist.slug, isCity ? 'city' : 'person'),
          name: protagonist.name,
          url: `${BASE_URL}/characters/${protagonist.slug}`,
        }
      })()
    : null

  return {
    '@type': 'CreativeWork',
    '@id': ID.work(release.slug),
    name: release.title,
    description: truncate(
      stripHtml(release.annotation ?? release.description) || `«${release.title}» на canfly`,
      300,
    ),
    image: imageObject(release.cover_image),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: toISODate(release.release_date ?? release.created_at),
    dateModified: toISODate(release.updated_at),
    author: releaseAuthors(release),
    publisher: ref(ID.organization),
    genre: releaseGenres(formats, release.genre),
    inLanguage: 'ru-RU',
    isAccessibleForFree: true,
    ...(series && { isPartOf: ref(ID.series(series.slug)) }),
    ...(persons.length > 0 && { character: persons }),
    ...(cities.length > 0 && { mentions: cities }),
    ...(protagonistNode && { about: protagonistNode }),
    ...(workExample.length > 0 && { workExample }),
    ...(release.view_count > 0 && {
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ReadAction',
        userInteractionCount: release.view_count,
      },
    }),
  }
}

// === Издание (страница читалки /vvvvv) ===

/**
 * Конкретное издание с главами. Тип зависит от формата, поэтому одна и та же
 * функция отдаёт `Book` для книги и `ComicIssue` для комикса.
 */
export function generateEditionSchema(opts: {
  edition: Edition
  release: Release
  chapters: Array<Pick<Chapter, 'id' | 'title' | 'chapter_index' | 'duration_seconds'>>
  meta: EditionMeta
  series?: { slug: string; title: string } | null
}) {
  const { edition, release, chapters, meta, series } = opts
  const spec = editionSchemaType(edition.format)
  const editionSlug = edition.slug || edition.id
  const url = editionUrl(editionSlug)
  const isAudio = isAudioSchemaType(spec.type)
  const tierLabel = QUALITY_TIER_EDITION_LABELS[edition.quality_tier]

  // У глав нет собственных индексируемых адресов (`/scroll/**` — noindex),
  // поэтому части описываются именем и позицией, без ссылок в никуда.
  const hasPart = chapters.map(chapter => ({
    '@type': isAudio ? 'AudioObject' : 'Chapter',
    name: chapter.title,
    position: chapter.chapter_index + 1,
    ...(isAudio && { duration: toISO8601Duration(chapter.duration_seconds ?? 0) }),
  }))

  return {
    '@type': spec.type,
    '@id': ID.edition(editionSlug),
    name: tierLabel ? `${release.title} — ${tierLabel.toLowerCase()}` : release.title,
    description: truncate(
      stripHtml(release.annotation ?? release.description) || `«${release.title}» на canfly`,
      300,
    ),
    image: imageObject(release.cover_image),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'ru-RU',
    isAccessibleForFree: true,
    datePublished: toISODate(release.release_date ?? edition.created_at),
    dateModified: toISODate(edition.updated_at),
    author: releaseAuthors(release),
    publisher: ref(ID.organization),
    // Издание — воплощение произведения: связь обязательна, иначе страницы
    // релиза и читалки выглядят как два независимых объекта.
    exampleOfWork: ref(ID.work(release.slug)),
    ...(spec.bookFormat && { bookFormat: spec.bookFormat }),
    ...(edition.format === 'book' && tierLabel && { bookEdition: tierLabel }),
    ...(edition.format === 'book' && release.isbn && { isbn: release.isbn }),
    ...(series &&
      spec.seriesType && {
        isPartOf: {
          '@type': spec.seriesType,
          '@id': ID.series(series.slug),
          name: series.title,
          url: `${BASE_URL}/series/${series.slug}`,
        },
      }),
    ...(meta.chapterCount > 0 && { numberOfPages: meta.chapterCount }),
    ...(!isAudio && meta.wordCount > 0 && { wordCount: meta.wordCount }),
    ...(!isAudio &&
      meta.readingMinutes > 0 && { timeRequired: `PT${meta.readingMinutes}M` }),
    ...(isAudio && { duration: toISO8601Duration(meta.durationSeconds) }),
    ...(hasPart.length > 0 && { hasPart }),
    potentialAction: {
      '@type': isAudio ? 'ListenAction' : 'ReadAction',
      target: { '@type': 'EntryPoint', urlTemplate: url },
    },
  }
}

// === Серия ===

export function generateSeriesSchema(series: Series, releases: SeriesRelease[]) {
  const url = `${BASE_URL}/series/${series.slug}`

  return {
    '@type': 'CreativeWorkSeries',
    '@id': ID.series(series.slug),
    name: series.title,
    description: truncate(
      stripHtml(series.description) || `Серия «${series.title}» на canfly`,
      300,
    ),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'ru-RU',
    author: ref(ID.author),
    publisher: ref(ID.organization),
    hasPart: releases.map(release => ({
      '@type': 'CreativeWork',
      '@id': ID.work(release.slug),
      name: release.title,
      url: `${BASE_URL}/release/${release.slug}`,
      ...(release.phase_number != null && { position: release.phase_number }),
      ...(release.cover_image && { image: release.cover_image }),
      datePublished: toISODate(release.release_date),
    })),
  }
}

// === Персонажи и профили ===

type CharacterSeed = Pick<Character, 'name' | 'slug' | 'avatar' | 'character_type'> &
  Partial<Pick<Character, 'bio' | 'full_description'>>

/**
 * Минимальный набор произведений, в которых персонаж участвует, для subjectOf.
 *
 * Это «ссылочные» узлы — только @id, имя и опциональный тип. Полные
 * описания лежат на странице самого релиза, дублировать их здесь — лишний
 * шум в графе и риск рассинхронизации.
 */
export interface CharacterSubjectRef {
  /** Slug релиза или серии — для сборки @id. */
  slug: string
  /** Название для подписи под @id в JSON-LD. */
  name: string
  /** 'CreativeWork' (по умолчанию), 'CreativeWorkSeries', 'Book'. */
  type?: 'CreativeWork' | 'CreativeWorkSeries' | 'Book'
}

/**
 * Узел персонажа в графе.
 *
 * `opts.subjectOf` — список ссылок на произведения/серии, где персонаж
 * значится (subjectOf на странице профиля). `opts.full: true` отдаёт полный
 * Person с описанием, иначе — краткий ref для вкраплений в `character`/`about`.
 */
export function characterNode(
  character: CharacterSeed,
  opts: { full: boolean; subjectOf?: CharacterSubjectRef[] },
) {
  const isCity = character.character_type === 'city'
  const url = `${BASE_URL}/characters/${character.slug}`

  const base = {
    '@type': isCity ? 'Place' : 'Person',
    '@id': ID.character(character.slug, isCity ? 'city' : 'person'),
    name: character.name,
    url,
    image: imageObject(character.avatar),
  }

  if (!opts.full) return base

  const bio = stripHtml(character.bio ?? character.full_description)
  const subjectOf = opts.subjectOf
    ?.filter(s => s?.slug)
    .map(s => {
      const node: Record<string, unknown> = {
        '@type': s.type ?? 'CreativeWork',
        '@id':
          s.type === 'CreativeWorkSeries'
            ? ID.series(s.slug)
            : ID.work(s.slug),
        name: s.name,
      }
      // url на серию — у произведения он уже есть в @id.
      if (s.type === 'CreativeWorkSeries') {
        node.url = `${BASE_URL}/series/${s.slug}`
      } else {
        node.url = `${BASE_URL}/release/${s.slug}`
      }
      return node
    })

  return {
    ...base,
    description: truncate(
      bio
        ? `${bio} — ${isCity ? 'место' : 'персонаж'} литературной вселенной canfly.`
        : `${isCity ? 'Место' : 'Персонаж'} литературной вселенной canfly.`,
      300,
    ),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(subjectOf && subjectOf.length > 0 && { subjectOf }),
  }
}

/**
 * JSON-LD профиля персонажа.
 *
 * `subjectOf` собирается на стороне вызова (там доступны данные о релизах):
 * достаточно передать список `{ slug, name, type? }`. Без них узел останется
 * с минимумом полей и не сломает разметку.
 */
export function generateCharacterSchema(
  character: CharacterSeed,
  opts: { subjectOf?: CharacterSubjectRef[]; jobTitle?: string; worksFor?: string } = {},
) {
  const url = `${BASE_URL}/characters/${character.slug}`

  return {
    '@type': 'ProfilePage',
    '@id': url,
    url,
    inLanguage: 'ru-RU',
    isPartOf: ref(ID.website),
    mainEntity: {
      ...characterNode(character, { full: true, subjectOf: opts.subjectOf }),
      // Поля Person: jobTitle/worksFor — стандартные для schema.org/Person.
      // Заголовок и место работы задаются через Bio (character.bio) — структурированных
      // полей в БД нет, поэтому их пробрасывает вызывающая сторона, если знает.
      ...(opts.jobTitle && { jobTitle: opts.jobTitle }),
      ...(opts.worksFor && { worksFor: { '@type': 'Organization', name: opts.worksFor } }),
    },
  }
}

/**
 * Профиль читателя. `ProfilePage` — тип, который Google ввёл специально для
 * UGC-страниц; без него публичный профиль читается как обычный текст.
 */
export function generateProfilePageSchema(
  user: Pick<UserProfile, 'handle' | 'display_name' | 'avatar' | 'bio' | 'tagline' | 'created_at'>,
  stats?: { quotes?: number },
) {
  const url = `${BASE_URL}/user/${user.handle}`
  const bio = stripHtml(user.tagline ?? user.bio)

  return {
    '@type': 'ProfilePage',
    '@id': url,
    url,
    inLanguage: 'ru-RU',
    isPartOf: ref(ID.website),
    dateCreated: toISODate(user.created_at),
    mainEntity: {
      '@type': 'Person',
      '@id': ID.user(user.handle),
      name: user.display_name,
      alternateName: `@${user.handle}`,
      url,
      image: imageObject(user.avatar),
      ...(bio && { description: truncate(bio, 300) }),
      ...(stats?.quotes != null &&
        stats.quotes > 0 && {
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/WriteAction',
            userInteractionCount: stats.quotes,
          },
        }),
    },
  }
}

// === Цитаты ===

export function generateQuotationSchema(opts: {
  highlight: ChapterHighlight
  release: Release
  chapter: Pick<Chapter, 'title'>
}) {
  const { highlight, release, chapter } = opts
  const url = `${BASE_URL}/highlight/${highlight.id}`

  return {
    '@type': 'Quotation',
    '@id': ID.quotation(highlight.id),
    text: highlight.text_content,
    url,
    inLanguage: 'ru-RU',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: toISODate(highlight.created_at),
    // Цитата принадлежит произведению, а выделил её читатель — это разные роли.
    isPartOf: ref(ID.work(release.slug)),
    citation: {
      '@type': 'CreativeWork',
      '@id': ID.work(release.slug),
      name: release.title,
      url: `${BASE_URL}/release/${release.slug}`,
      ...(chapter.title && { alternativeHeadline: chapter.title }),
    },
    ...(highlight.user_name && {
      creator: { '@type': 'Person', name: highlight.user_name },
    }),
    ...(highlight.likes_count > 0 && {
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: highlight.likes_count,
      },
    }),
  }
}

// === Новости ===

/**
 * Тип оставлен `Article`, а не `NewsArticle`: `section` здесь произвольный
 * («dispatch», заметки, маршруты), а `NewsArticle` Google ожидает у настоящих
 * новостных изданий.
 */
export function generateNewsArticleSchema(post: NewsPost, authorName?: string | null) {
  const url = `${BASE_URL}/news/${post.id}`
  const body = stripHtml(post.content)

  return {
    '@type': 'Article',
    '@id': url,
    headline: truncate(post.title, 110),
    description: truncate(body || post.title),
    url,
    image: imageObject(post.cover_image),
    datePublished: toISODate(post.published_at ?? post.created_at),
    dateModified: toISODate(post.updated_at ?? post.published_at ?? post.created_at),
    author: authorName ? { '@type': 'Person', name: authorName } : ref(ID.author),
    publisher: ref(ID.organization),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: ref(ID.website),
    inLanguage: 'ru-RU',
    articleSection: post.section,
    ...(post.tag && { keywords: post.tag }),
    ...(body && { wordCount: body.split(/\s+/).length }),
  }
}

// === Простая страница ===

export function generateWebPageSchema(opts: {
  name: string
  description: string
  path: string
}) {
  const url = `${BASE_URL}${opts.path}`

  return {
    '@type': 'WebPage',
    '@id': url,
    name: opts.name,
    description: truncate(stripHtml(opts.description)),
    url,
    inLanguage: 'ru-RU',
    isPartOf: ref(ID.website),
    publisher: ref(ID.organization),
  }
}

/** Совместимость: корень отдаёт полный узел WebSite через `websiteNode()`. */
export function generateWebSiteSchema() {
  return websiteNode()
}

export function generateOrganizationSchema() {
  return organizationNode()
}
