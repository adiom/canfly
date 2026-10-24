import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/session'
import { upsertReadingProgress } from '@/lib/server/reading-progress'
import { apiHandler } from '@/lib/api-handler'
import { z } from 'zod'

const progressSchema = z.object({
  editionId: z.string().uuid(),
  chapterId: z.string().uuid(),
  progressPercent: z.number().finite().min(0).max(100),
  position: z.object({
    paragraphIndex: z.number().int().min(0).max(1_000_000),
    offset: z.number().int().min(0).max(10_000_000),
  }).nullable().optional(),
})

/**
 * POST /api/reading-progress
 * Сохраняет прогресс чтения пользователя.
 * Требует авторизацию (гостевой прогресс через session_id не реализован —
 * только для залогиненных, как в ридере).
 */
async function saveReadingProgress(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = progressSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Некорректный прогресс чтения' }, { status: 400 })

  await upsertReadingProgress({
    editionId: parsed.data.editionId,
    chapterId: parsed.data.chapterId,
    userId: user.id,
    progressPercent: parsed.data.progressPercent,
    position: parsed.data.position,
  })

  return NextResponse.json({ data: { ok: true } })
}

export const POST = apiHandler(saveReadingProgress)
