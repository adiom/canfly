import 'server-only'
import sanitizeHtmlLib from 'sanitize-html'

// sanitize-html вместо isomorphic-dompurify: последний тянет условный jsdom и
// падает на Vercel (из-за чего санитизацию однажды просто сняли с /news/[id]).
// Этот работает только на сервере — и там же ему и место: чистить нужно на
// входе и на выходе из БД, а не в браузере, который мы не контролируем.

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'b', 'i',
  'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
]

const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    '*': ['class', 'id'],
  },
  // Только безопасные схемы: javascript:/data: в href отсекаются
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  // Внешние ссылки не должны получать доступ к window.opener
  transformTags: {
    a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
  disallowedTagsMode: 'discard',
}

/** Чистит HTML главы/новости. Применять и при записи, и перед рендером. */
export function sanitizeChapterHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtmlLib(html, OPTIONS)
}

/** Алиас для произвольного пользовательского HTML */
export const sanitizeHtml = sanitizeChapterHtml

/** Plain-text user fields: strips markup and normalizes surrounding whitespace. */
export function sanitizePlainText(value: string | null | undefined): string {
  if (!value) return ''
  return sanitizeHtmlLib(value, { allowedTags: [], allowedAttributes: {} }).trim()
}
