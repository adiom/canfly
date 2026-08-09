import type { Release, Edition, EditionFormat, QualityTier } from '@/lib/releases-types'

/**
 * Сериализует JSON-LD для безопасной вставки в тег <script>.
 *
 * JSON.stringify не экранирует закрывающий тег script: пользовательское
 * значение с </script> могло завершить JSON-LD и добавить исполняемый код.
 */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value) ?? 'null'

  return json.replace(/[<>&\u2028\u2029]/g, (character) => {
    const escapedCharacters: Record<string, string> = {
      '<': '\\u003c',
      '>': '\\u003e',
      '&': '\\u0026',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    }

    return escapedCharacters[character]
  })
}

const CANFLY_AUTHOR = {
  '@type': 'Person',
  name: 'Адиом Тимур',
  url: 'https://canfly.org/',
  sameAs: ['https://twitter.com/adiomtimur', 'https://github.com/adiom'],
}

function bookGenres(formats: EditionFormat[], genre: string | null): string[] {
  const g: string[] = ['Fiction', 'Contemporary Fiction']
  if (formats.includes('comic')) g.push('Comics & Graphic Novels')
  if (genre && !g.includes(genre)) g.push(genre)
  return g
}

const tierNameSuffixes: Record<QualityTier, string> = {
  draft: ' — черновик',
  standard: '',
  premium: ' — иллюстрированное издание',
}

export function generateReleaseSchema(
  release: Release,
  formats: EditionFormat[],
  baseUrl: string,
  bookEditions?: Edition[],
  characters?: Array<{ name: string; slug: string; avatar: string | null }>
) {
  const url = baseUrl + '/release/' + release.slug

  const workExample = (bookEditions ?? [])
    .filter(e => e.status === 'published')
    .map(edition => ({
      '@type': 'Book',
      '@id': baseUrl + '/scroll/' + (edition.slug || edition.id) + '/1',
      name: release.title + (tierNameSuffixes[edition.quality_tier] ?? ''),
      bookEdition: edition.quality_tier,
      url: baseUrl + '/scroll/' + (edition.slug || edition.id) + '/1',
    }))

  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': url + '#work',
    name: release.title,
    description: release.annotation ?? release.description ?? '«' + release.title + '» на canfly',
    image: release.cover_image
      ? { '@type': 'ImageObject', url: release.cover_image }
      : undefined,
    url,
    datePublished: release.release_date ?? new Date(release.created_at).toISOString().split('T')[0],
    dateModified: new Date(release.updated_at).toISOString().split('T')[0],
    author: CANFLY_AUTHOR,
    publisher: {
      '@type': 'Organization',
      name: 'canfly',
      url: baseUrl,
    },
    genre: bookGenres(formats, release.genre),
    inLanguage: 'ru-RU',
    ...(release.isbn && { isbn: release.isbn }),
    ...(characters && characters.length > 0 && {
      character: characters.map((char) => ({
        '@type': 'Person',
        name: char.name,
        url: baseUrl + '/characters/' + char.slug,
        ...(char.avatar && { image: { '@type': 'ImageObject', url: char.avatar } }),
      })),
    }),
    ...(workExample.length > 0 && { workExample }),
  }
}

export function generateWebSiteSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'canfly',
    url: baseUrl,
    description:
      'Литературная вселенная о тревоге, ремесле, памяти, цифровой усталости и людях, которые продолжают функционировать.',
    inLanguage: 'ru-RU',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: baseUrl + '/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function generateOrganizationSchema(baseUrl: string) {
  const id = baseUrl + '/#organization'

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': id,
    name: 'canfly',
    description:
      'canfly — литературная вселенная о тревоге, ремесле, памяти, цифровой усталости и людях, которые продолжают функционировать.',
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: baseUrl + '/logo.png',
    },
    sameAs: ['https://twitter.com/adiomtimur', 'https://github.com/adiom'],
    founder: { '@type': 'Person', name: 'Адиом Тимур' },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+7-999-512-2887',
      contactType: 'Customer Support',
      email: 'support@canfly.org',
    },
  }
}

export function generateBreadcrumbSchema(
  items: Array<{ label: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: item.url,
    })),
  }
}

export function generateNewsArticleSchema(
  post: {
    id: string
    title: string
    content: string | null
    section: string
    created_at: string
    cover_image?: string | null
    published_at?: string | null
  },
  baseUrl: string
) {
  const url = baseUrl + '/news/' + post.id
  const dateSource = post.published_at ?? post.created_at

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': url,
    headline: post.title,
    description: post.content?.slice(0, 160) ?? post.title,
    datePublished: new Date(dateSource).toISOString().split('T')[0],
    image: post.cover_image ?? undefined,
    author: CANFLY_AUTHOR,
    publisher: {
      '@type': 'Organization',
      name: 'canfly',
      url: baseUrl,
      logo: { '@type': 'ImageObject', url: baseUrl + '/logo.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'ru-RU',
    articleSection: post.section,
  }
}

export function generateCharacterSchema(
  character: { name: string; slug: string; avatar: string | null; bio: string | null },
  baseUrl: string
) {
  const url = baseUrl + '/characters/' + character.slug

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': url,
    name: character.name,
    description: character.bio
      ? character.bio + ' — персонаж литературной вселенной canfly.'
      : 'Персонаж литературной вселенной canfly.',
    image: character.avatar
      ? { '@type': 'ImageObject', url: character.avatar }
      : undefined,
    url,
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
