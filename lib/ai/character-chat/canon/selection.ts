import { createHash } from 'node:crypto'

import type { ActiveCanonManifest, CanonScope, CanonSegment } from './manifest'

/**
 * Чистый отбор фрагментов канона: без БД и без модели.
 *
 * Серверный слой (`lib/server/character-canon.ts`) читает опубликованные
 * главы и передаёт сюда уже нормализованный текст и хеш. Здесь решается
 * только одно: можно ли подавать фрагмент модели. Любое сомнение — отказ.
 */

/** Строка главы, прочитанная сервером. Текста книги в манифесте нет. */
export interface ResolvedCanonSource {
  chapterId: string
  chapterIndex: number
  chapterStatus: string
  editionSlug: string
  editionStatus: string
  releaseSlug: string
  releaseStatus: string
  /** `release_characters.role` для этого персонажа; `null` — связи нет. */
  characterRole: string | null
  /** Нормализованный текст главы (`chapterPlainText`). */
  plainText: string
  /** sha256 нормализованного текста главы. */
  chapterHash: string
}

export type CanonSkipReason =
  | 'source_not_found'
  | 'empty_content'
  | 'chapter_unpublished'
  | 'edition_unpublished'
  | 'release_unpublished'
  | 'character_not_linked'
  | 'scope_mismatch'
  | 'chapter_moved'
  | 'beyond_knowledge_cutoff'
  | 'chapter_changed'
  | 'anchor_missing'
  | 'fragment_changed'
  | 'over_budget'

export interface IncludedCanonSegment {
  id: string
  chapterId: string
  chapterIndex: number
  text: string
  fragmentHash: string
}

export interface SkippedCanonSegment {
  id: string
  reason: CanonSkipReason
}

export interface CanonSelection {
  included: IncludedCanonSegment[]
  skipped: SkippedCanonSegment[]
  totalChars: number
}

/**
 * sha256 нормализованного текста. Тот же алгоритм и тот же вход, что у
 * `sourceRevision()` из `lib/server/highlight-source.ts`, поэтому хеши глав
 * сопоставимы между подсистемами.
 */
export function hashPlainText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Выдержка начинается с якоря и ограничена `maxChars`. Если предел рвёт слово,
 * отступаем до ближайшего пробела — но только когда это не отрезает больше
 * 40% выдержки, иначе оставляем жёсткий предел.
 */
export function extractFragment(
  plainText: string,
  anchor: string,
  maxChars: number,
): string | null {
  const needle = anchor.trim()
  if (!needle || maxChars < 1) return null

  const start = plainText.indexOf(needle)
  if (start < 0) return null

  const hardEnd = start + maxChars
  const raw = plainText.slice(start, hardEnd)
  let excerpt = raw.trim()

  if (hardEnd < plainText.length) {
    const lastSpace = excerpt.lastIndexOf(' ')
    if (lastSpace > excerpt.length * 0.6) {
      excerpt = excerpt.slice(0, lastSpace).trim()
    }
  }

  return excerpt.length > 0 ? excerpt : null
}

function checkSource(
  segment: CanonSegment,
  scope: CanonScope,
  source: ResolvedCanonSource,
): CanonSkipReason | null {
  if (!source.plainText.trim()) return 'empty_content'
  if (source.chapterStatus !== 'published') return 'chapter_unpublished'
  if (source.editionStatus !== 'published') return 'edition_unpublished'
  if (source.releaseStatus !== 'published') return 'release_unpublished'
  if (!source.characterRole) return 'character_not_linked'
  if (source.releaseSlug !== scope.releaseSlug) return 'scope_mismatch'
  if (source.editionSlug !== scope.editionSlug) return 'scope_mismatch'
  if (source.chapterIndex !== segment.chapterIndex) return 'chapter_moved'
  if (source.chapterIndex > scope.knowledgeCutoffChapterIndex) return 'beyond_knowledge_cutoff'
  if (source.chapterHash !== segment.chapterHash) return 'chapter_changed'
  return null
}

/**
 * Отбирает фрагменты в порядке манифеста. Бюджет общий, поэтому один длинный
 * фрагмент не вытесняет остальные молча — лишнее попадает в `skipped`.
 */
export function selectCanonSegments(input: {
  manifest: ActiveCanonManifest
  scope: CanonScope
  sources: readonly ResolvedCanonSource[]
  maxTotalChars?: number
}): CanonSelection {
  const { manifest, scope, sources } = input
  const budget = input.maxTotalChars ?? manifest.maxTotalChars

  const byChapter = new Map<string, ResolvedCanonSource>()
  for (const source of sources) {
    byChapter.set(source.chapterId, source)
  }

  const included: IncludedCanonSegment[] = []
  const skipped: SkippedCanonSegment[] = []
  let totalChars = 0

  for (const segment of manifest.segments) {
    const source = byChapter.get(segment.chapterId)
    if (!source) {
      skipped.push({ id: segment.id, reason: 'source_not_found' })
      continue
    }

    const reason = checkSource(segment, scope, source)
    if (reason) {
      skipped.push({ id: segment.id, reason })
      continue
    }

    const excerpt = extractFragment(source.plainText, segment.anchor, segment.maxChars)
    if (!excerpt) {
      skipped.push({ id: segment.id, reason: 'anchor_missing' })
      continue
    }

    const fragmentHash = hashPlainText(excerpt)
    if (fragmentHash !== segment.fragmentHash) {
      skipped.push({ id: segment.id, reason: 'fragment_changed' })
      continue
    }

    if (totalChars + excerpt.length > budget) {
      skipped.push({ id: segment.id, reason: 'over_budget' })
      continue
    }

    totalChars += excerpt.length
    included.push({
      id: segment.id,
      chapterId: segment.chapterId,
      chapterIndex: source.chapterIndex,
      text: excerpt,
      fragmentHash,
    })
  }

  return { included, skipped, totalChars }
}
