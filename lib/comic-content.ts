/**
 * Комиксы хранят страницы как JSON-массив строк, а не HTML. HTML-санитайзер
 * превращал `&` в `&amp;` и ломал query-параметры URL, поэтому такие значения
 * распознаются и обрабатываются как структура.
 */
export function parseComicPagesJson(value: string | null | undefined): string[] | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) return null
    return parsed as string[]
  } catch {
    return null
  }
}

/** Канонический JSON для страниц; `null`, если значение не является страницами. */
export function normalizeComicPagesJson(value: string | null | undefined): string | null {
  const pages = parseComicPagesJson(value)
  // JSON can reach readers that display chapter content as HTML. Keep it safe
  // without changing URLs: JSON.parse decodes the escaped angle brackets.
  return pages ? JSON.stringify(pages).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') : null
}
