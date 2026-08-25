import type { EditionFormat, QualityTier } from '@/lib/releases-types'

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

/**
 * Стабильные `@id` сущностей.
 *
 * Без них Google видит на каждой странице новую безымянную Organization/Person
 * и не склеивает их в одну сущность. Полный узел отдаётся ровно один раз
 * (Organization — из layout, WebSite — с корня), остальные страницы ссылаются
 * на него `{ '@id': ... }`.
 */
export const ID = {
  organization: `${BASE_URL}/#organization`,
  website: `${BASE_URL}/#website`,
  author: `${BASE_URL}/#author`,
  work: (releaseSlug: string) => `${BASE_URL}/release/${releaseSlug}#work`,
  edition: (editionSlug: string) => `${BASE_URL}/vvvvv/${editionSlug}#edition`,
  series: (seriesSlug: string) => `${BASE_URL}/series/${seriesSlug}#series`,
  character: (slug: string, type: 'person' | 'city') =>
    `${BASE_URL}/characters/${slug}#${type === 'city' ? 'place' : 'person'}`,
  user: (handle: string) => `${BASE_URL}/user/${handle}#person`,
  quotation: (id: string) => `${BASE_URL}/highlight/${id}#quote`,
} as const

/** Ссылка на сущность вместо повторного инлайна полного узла. */
export function ref(id: string) {
  return { '@id': id }
}

/**
 * Канонический адрес издания — всегда `/vvvvv/[slug]`.
 */
export function editionUrl(editionSlug: string) {
  return `${BASE_URL}/vvvvv/${editionSlug}`
}

export function imageObject(url: string | null | undefined) {
  return url ? { '@type': 'ImageObject', url } : undefined
}

// === Формат издания → тип schema.org ===

export interface EditionTypeSpec {
  /** Тип самого издания. */
  type: string
  /** Тип серии, в которую издание входит (`isPartOf`), если он специфичен. */
  seriesType?: string
  /** Значение `bookFormat` — только у книжных типов. */
  bookFormat?: string
}

/**
 * Карта намеренно `Record<EditionFormat, ...>`: новый формат в
 * `lib/releases-types.ts` должен ломать сборку, а не молча выпадать
 * из разметки безымянным CreativeWork.
 */
export const EDITION_SCHEMA_TYPES: Record<EditionFormat, EditionTypeSpec> = {
  book: {
    type: 'Book',
    seriesType: 'BookSeries',
    bookFormat: 'https://schema.org/EBook',
  },
  magazine: { type: 'PublicationIssue', seriesType: 'Periodical' },
  comic: { type: 'ComicIssue', seriesType: 'ComicSeries' },
  audiobook: {
    type: 'Audiobook',
    seriesType: 'BookSeries',
    bookFormat: 'https://schema.org/AudiobookFormat',
  },
  audiorelease: { type: 'AudioObject' },
  album: { type: 'MusicAlbum' },
  digital: { type: 'DigitalDocument' },
}

export function editionSchemaType(format: EditionFormat): EditionTypeSpec {
  return EDITION_SCHEMA_TYPES[format] ?? { type: 'CreativeWork' }
}

const AUDIO_SCHEMA_TYPES = new Set(['Audiobook', 'AudioObject', 'MusicAlbum'])

export function isAudioSchemaType(type: string): boolean {
  return AUDIO_SCHEMA_TYPES.has(type)
}

/** Тираж в человекочитаемом виде — `bookEdition: 'draft'` поисковику ничего не говорит. */
export const QUALITY_TIER_EDITION_LABELS: Record<QualityTier, string> = {
  draft: 'Черновик',
  standard: 'Полная версия',
  premium: 'Иллюстрированное издание',
}

/**
 * Секунды → ISO-8601 duration (`PT3H12M`). Нужен для `duration` у аудио-изданий:
 * schema.org принимает только этот формат, число секунд игнорируется.
 */
export function toISO8601Duration(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined

  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  const parts = ['PT']
  if (hours > 0) parts.push(`${hours}H`)
  if (minutes > 0) parts.push(`${minutes}M`)
  if (secs > 0 && hours === 0) parts.push(`${secs}S`)

  return parts.length > 1 ? parts.join('') : 'PT0S'
}

/** Дата в `YYYY-MM-DD`; невалидный вход отбрасывается, а не даёт `Invalid Date`. */
export function toISODate(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0]
}

// === Базовые узлы графа ===

export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ID.organization,
    name: 'canfly',
    description:
      'canfly — литературная вселенная о тревоге, ремесле, памяти, цифровой усталости и людях, которые продолжают функционировать.',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/logo.png`,
    },
    sameAs: [
      'https://x.com/_canfly',
      'https://github.com/Canfly',
      'https://www.linkedin.com/company/canfly/',
    ],
    founder: ref(ID.author),
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+7-999-512-2887',
      contactType: 'Customer Support',
      email: 'support@canfly.org',
    },
  }
}

export function authorNode() {
  return {
    '@type': 'Person',
    '@id': ID.author,
    name: 'Адиом Тимур',
    url: `${BASE_URL}/user/adiom`,
    sameAs: ['https://twitter.com/adiomtimur', 'https://github.com/adiom'],
  }
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': ID.website,
    name: 'canfly',
    url: BASE_URL,
    description:
      'Литературная вселенная о тревоге, ремесле, памяти, цифровой усталости и людях, которые продолжают функционировать.',
    inLanguage: 'ru-RU',
    publisher: ref(ID.organization),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}
