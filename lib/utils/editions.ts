import type { Edition, EditionFormat } from '@/lib/releases-types'

const FORMAT_PRIORITY: EditionFormat[] = [
  'book',
  'comic',
  'magazine',
  'audiobook',
  'audiorelease',
  'album',
]

export function getPrimaryEdition(editions: Edition[]): Edition | null {
  const published = editions.filter(e => e.status === 'published')
  if (published.length === 0) return null

  // 1. Explicit is_primary flag
  const explicit = published.find(e => e.is_primary)
  if (explicit) return explicit

  // 2. Standard tier (best default for SEO/UX, not draft)
  const standard = published.find(e => e.quality_tier === 'standard')
  if (standard) return standard

  // 3. FORMAT_PRIORITY fallback
  return published.sort(
    (a, b) => FORMAT_PRIORITY.indexOf(a.format) - FORMAT_PRIORITY.indexOf(b.format),
  )[0]
}

/**
 * Ссылка на главу. У book-издания SEO-вариант с quality_tier, у остальных —
 * editionSlug; /release/[slug]/[editionSlug] всё равно редиректит book на первый вид.
 */
export function getChapterUrl(
  releaseSlug: string,
  edition: { format: EditionFormat; slug: string; quality_tier: string },
  chapterNumber: number,
): string {
  if (edition.format === 'book') {
    return `/release/${releaseSlug}/book/${edition.quality_tier}/${chapterNumber}`
  }
  return `/release/${releaseSlug}/${edition.slug}/${chapterNumber}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}
