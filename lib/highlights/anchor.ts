import type { TextAnchor } from './types'

// Same canonicalization on the server and in the DOM. Positions are UTF-16.
export function normalizeHighlightText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim()
}

export function resolveAnchor(text: string, anchor: Pick<TextAnchor, 'start' | 'end' | 'exact' | 'prefix' | 'suffix'>): { start: number; end: number; status: 'exact' | 'moved' } | null {
  if (!anchor.exact) return null
  const matches: number[] = []
  let at = text.indexOf(anchor.exact)
  while (at !== -1) {
    matches.push(at)
    at = text.indexOf(anchor.exact, at + 1)
  }
  const contextual = matches.filter(start =>
    (!anchor.prefix || text.slice(Math.max(0, start - anchor.prefix.length), start) === anchor.prefix) &&
    (!anchor.suffix || text.slice(start + anchor.exact.length, start + anchor.exact.length + anchor.suffix.length) === anchor.suffix),
  )
  const candidates = contextual.length ? contextual : matches
  if (candidates.length !== 1) return null
  const start = candidates[0]
  return { start, end: start + anchor.exact.length, status: start === anchor.start ? 'exact' : 'moved' }
}
