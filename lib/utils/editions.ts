import type { Edition, EditionFormat, QualityTier } from '@/lib/releases-types'

const FORMAT_PRIORITY: EditionFormat[] = [
  'book',
  'comic',
  'magazine',
  'audiobook',
  'audiorelease',
  'album',
  'digital',
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
 * Ссылка на главу издания. Все форматы ведут в `/vvvvv/[editionSlug]`.
 */
export function getChapterUrl(
  _releaseSlug: string,
  edition: { format: EditionFormat; slug: string; quality_tier: string },
  _chapterNumber: number,
): string {
  return `/vvvvv/${edition.slug}`
}

/**
 * Ссылка на вход в издании — всегда `/vvvvv/[editionSlug]`.
 */
export function getEditionTocUrl(
  releaseSlug: string,
  edition: { format: EditionFormat; slug: string; quality_tier: string },
): string {
  return `/vvvvv/${edition.slug}`
}

export const EDITION_FORMAT_LABELS: Record<EditionFormat, string> = {
  book: 'Книга',
  comic: 'Комикс',
  magazine: 'Журнал',
  audiobook: 'Аудиокнига',
  audiorelease: 'Аудиорелиз',
  album: 'Альбом',
  digital: 'Цифровой релиз',
}

export const QUALITY_TIER_LABELS: Record<QualityTier, string> = {
  draft: 'Черновик',
  standard: 'Полная версия',
  premium: 'Иллюстрированная',
}

/** Подпись издания в кнопках и переключателях: у book — тираж, у остальных — формат. */
export function getEditionLabel(edition: {
  format: EditionFormat
  quality_tier: QualityTier
}): string {
  if (edition.format === 'book' && edition.quality_tier) {
    return QUALITY_TIER_LABELS[edition.quality_tier] ?? EDITION_FORMAT_LABELS.book
  }
  return EDITION_FORMAT_LABELS[edition.format] ?? edition.format
}

const AUDIO_FORMATS: EditionFormat[] = ['audiobook', 'audiorelease', 'album']

export function isAudioFormat(format: EditionFormat): boolean {
  return AUDIO_FORMATS.includes(format)
}

export function isDigitalFormat(format: EditionFormat): boolean {
  return format === 'digital'
}

export interface EditionMeta {
  chapterCount: number
  wordCount: number
  readingMinutes: number
  durationSeconds: number
}

/**
 * Агрегаты по главам издания. Считалось инлайном в app/release/[slug]/page.tsx —
 * вынесено, чтобы страница релиза и оглавление издания не расходились в цифрах.
 */
export function computeEditionMeta(
  chapters: Array<{ word_count?: number | null; duration_seconds?: number | null }>,
): EditionMeta {
  const wordCount = chapters.reduce((sum, c) => sum + (c.word_count ?? 0), 0)
  const durationSeconds = chapters.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0)
  return {
    chapterCount: chapters.length,
    wordCount,
    readingMinutes: wordCount > 0 ? Math.max(1, Math.round(wordCount / 200)) : 0,
    durationSeconds,
  }
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
