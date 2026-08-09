import { cache } from 'react'
import type { Chapter } from '@/lib/releases-types'
import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { fetchReadingProgress } from '@/lib/server/reading-progress'

/**
 * Общий слой данных для читалки `/scroll/[slug]` — по образцу `/vvvvv/[slug]`.
 * `cache()` схлопывает пару generateMetadata/рендер в один запрос на рендер:
 * `dbQuery` собственной дедупликации не имеет.
 */
export const loadScrollEdition = cache((idOrSlug: string) => fetchEditionByIdOrSlug(idOrSlug))
export const loadScrollRelease = cache((releaseId: string) => fetchReleaseById(releaseId))
export const loadScrollChapters = cache((editionId: string) => fetchPublishedChaptersByEdition(editionId))

/**
 * Глава, с которой продолжать чтение. Прогресс живёт по последним `last_read_at`,
 * так что достаточно одной записи на издание.
 */
export async function getScrollResumeIndex(
  editionId: string,
  userId: string | null,
  chapters: Chapter[],
): Promise<number> {
  if (!userId || chapters.length === 0) return 0
  const progress = await fetchReadingProgress(editionId, userId)
  const index = progress ? chapters.findIndex(ch => ch.id === progress.chapter_id) : -1
  return index >= 0 ? index : 0
}