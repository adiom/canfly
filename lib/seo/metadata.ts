import type { Metadata } from 'next'
import { BASE_URL } from '@/lib/seo/entities'

/**
 * Снимает HTML-теги и схлопывает пробелы.
 *
 * Описания новостей резались прямо из `post.content`, поэтому в `<meta>`
 * попадала разметка (`<p>Текст…`). Санитайзер здесь не нужен — результат
 * идёт только в текстовые атрибуты, но теги мешают и людям, и поисковику.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Обрезка по границе слова — «…» посреди слова выглядит как баг вёрстки. */
export function truncate(text: string, max = 160): string {
  const clean = text.trim()
  if (clean.length <= max) return clean

  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

function truncateSeoDescription(text: string, max = 155): string {
  const clean = stripHtml(text).trim()
  if (!clean) return DEFAULT_DESCRIPTION

  if (clean.length <= max) {
    const normalized = clean.replace(/[.?!]+$/u, '').trim()
    return normalized ? `${normalized}.` : DEFAULT_DESCRIPTION
  }

  const limit = Math.max(20, max - 1)
  const cut = clean.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()
  const normalized = trimmed.replace(/[.?!,;:]+$/u, '').trim()
  return normalized ? `${normalized}.` : DEFAULT_DESCRIPTION
}

export type OgType = 'website' | 'article' | 'book' | 'profile'

export interface BuildMetadataOptions {
  title: string
  description?: string | null
  /** Путь от корня, начиная со слэша. Абсолютный URL соберётся сам. */
  path: string
  image?: string | null
  imageAlt?: string
  /**
   * Рядом с `page.tsx` лежит `opengraph-image.tsx` — картинку подставит
   * файловая конвенция, здесь `openGraph.images` задавать нельзя (см. ниже).
   */
  generatedImage?: boolean
  ogType?: OgType
  noindex?: boolean
  /** `og:type='article'` — время публикации и правки. */
  publishedTime?: string | null
  modifiedTime?: string | null
  siteName?: string
}

const DEFAULT_DESCRIPTION =
  'canfly — литературная вселенная: комиксы, книги, аудиокниги и журналы о тревоге, ремесле, памяти и людях, которые продолжают функционировать.'

/**
 * Дефолтный баннер — генератор в корне `app/opengraph-image.tsx`.
 *
 * Путь относительный: Next достроит его до абсолютного через `metadataBase`,
 * поэтому в dev ссылка ведёт на localhost. С захардкоженным `BASE_URL`
 * локальная страница отправляла бы соцсети (и e2e) на прод.
 */
const DEFAULT_OG_IMAGE = '/opengraph-image'

/**
 * Единая сборка title/description/canonical/OG/Twitter.
 *
 * До этого каждая страница собирала блок руками, поэтому у части не было
 * `twitter`, у `/scroll` — вообще ничего, а у `/series` стоял `og:type: 'book'`
 * без обязательных для него `book:author`/`book:isbn`.
 */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const {
    title,
    path,
    image,
    imageAlt,
    generatedImage = false,
    ogType = 'website',
    noindex = false,
    publishedTime,
    modifiedTime,
    siteName = 'canfly',
  } = opts

  const description = truncateSeoDescription(opts.description)
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  /*
   * Картинку из `opengraph-image.tsx` Next подставляет только сегменту, где
   * лежит файл, и только если `openGraph.images` там не задан вовсе
   * (`resolve-metadata`: проверка `hasOwnProperty('images')`). При этом
   * `openGraph` страницы целиком заменяет унаследованный от layout — поэтому
   * корневой баннер до вложенных страниц сам не доходит и его приходится
   * проставлять явно, иначе og:image пропадает совсем.
   */
  const resolvedImage = image ?? (generatedImage ? null : DEFAULT_OG_IMAGE)
  const images = resolvedImage ? [{ url: resolvedImage, alt: imageAlt ?? title }] : undefined

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noindex && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale: 'ru_RU',
      type: ogType,
      ...(images && { images }),
      ...(ogType === 'article' && {
        ...(publishedTime && { publishedTime }),
        ...(modifiedTime && { modifiedTime }),
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(resolvedImage && { images: [resolvedImage] }),
    },
  }
}

/** Метаданные ненайденной сущности: одинаковые везде и всегда noindex. */
export function notFoundMetadata(label = 'Не найдено'): Metadata {
  return {
    title: `${label} | canfly`,
    robots: { index: false, follow: false },
  }
}
