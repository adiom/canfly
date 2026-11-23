'use server'

import { getChapterWriteAccess, requireChapterOwnership } from '@/lib/server/studio-auth'
import {
  acquireChapterLease,
  fetchChapterLease,
  releaseChapterLease,
  renewChapterLease,
  type ChapterLease,
  type ChapterLeaseHolder,
} from '@/lib/server/chapter-leases'
import { chapterIdSchema, chapterLeaseProofSchema } from '@/lib/schemas/studio'

export type ChapterLeaseActionResult =
  | { ok: true; lease: ChapterLease }
  | { ok: false; code: 'validation' | 'lease-lost' | 'forbidden' | 'error'; message: string }

export type ChapterLeaseAcquireResult =
  | { ok: true; lease: ChapterLease }
  | { ok: false; code: 'validation' | 'lease-held' | 'forbidden'; holder: ChapterLeaseHolder | null }

/** Захват права редактирования: один активный lease на главу. */
export async function acquireChapterLeaseAction(
  chapterId: string,
  sessionId: string,
  documentId: string,
): Promise<ChapterLeaseAcquireResult> {
  if (!chapterIdSchema.safeParse(chapterId).success ||
      typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 128 ||
      typeof documentId !== 'string' || documentId.length < 8 || documentId.length > 128) {
    return { ok: false, code: 'validation', holder: null }
  }

  const access = await getChapterWriteAccess(chapterId)
  if (access.status !== 'ok') {
    return { ok: false, code: 'forbidden', holder: null }
  }
  const acquired = await acquireChapterLease({
    chapterId,
    sessionId,
    documentId,
    actor: { userId: access.session.user.id, actorKind: 'studio' },
  })
  return acquired.ok
    ? { ok: true, lease: acquired.lease }
    : { ok: false, code: 'lease-held', holder: acquired.holder }
}

/** Heartbeat активной вкладки. */
export async function renewChapterLeaseAction(
  chapterId: string,
  sessionId: string,
  proof: unknown,
): Promise<ChapterLeaseActionResult> {
  const parsedProof = chapterLeaseProofSchema.safeParse(proof)
  if (!chapterIdSchema.safeParse(chapterId).success || !parsedProof.success) {
    return { ok: false, code: 'validation', message: 'Некорректный lease' }
  }

  const access = await getChapterWriteAccess(chapterId)
  if (access.status !== 'ok') {
    return { ok: false, code: 'forbidden', message: 'Доступ к главе отозван' }
  }
  try {
    const renewed = await renewChapterLease({
      chapterId,
      sessionId,
      actor: { userId: access.session.user.id, actorKind: 'studio' },
      proof: parsedProof.data,
    })
    return renewed.ok
      ? { ok: true, lease: renewed.lease }
      : { ok: false, code: 'lease-lost', message: 'Право редактирования потеряно' }
  } catch {
    return { ok: false, code: 'error', message: 'Не удалось продлить право редактирования' }
  }
}

/** Освобождение при закрытии вкладки или переходе на другую главу. */
export async function releaseChapterLeaseAction(
  chapterId: string,
  sessionId: string,
  proof: unknown,
): Promise<{ ok: boolean }> {
  const parsedProof = chapterLeaseProofSchema.safeParse(proof)
  if (!chapterIdSchema.safeParse(chapterId).success || !parsedProof.success) return { ok: false }

  const { session } = await requireChapterOwnership(chapterId)
  try {
    return {
      ok: await releaseChapterLease({
        chapterId,
        sessionId,
        actor: { userId: session.user.id, actorKind: 'studio' },
        proof: parsedProof.data,
      }),
    }
  } catch {
    return { ok: false }
  }
}

/** Статус нужен для баннера «глава редактируется» и повторного захвата. */
export async function getChapterLeaseStatusAction(chapterId: string): Promise<ChapterLeaseHolder | null> {
  if (!chapterIdSchema.safeParse(chapterId).success) return null
  await requireChapterOwnership(chapterId)
  return fetchChapterLease(chapterId)
}
