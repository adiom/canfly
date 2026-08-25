import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/session'
import { updateEditorialNoteStatus, canManageChapterEditorialNotes, fetchEditorialNoteChapterId } from '@/lib/server/chapter-highlights'
import { apiHandler } from '@/lib/api-handler'
import { editorialStatusSchema } from '@/lib/schemas/highlights'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

async function updateEditorialNoteStatusHandler(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chapterId = await fetchEditorialNoteChapterId(id)
  if (!chapterId) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  const allowed = await canManageChapterEditorialNotes(chapterId, user.id, user.is_admin)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const limit = await checkRateLimit({ bucket: 'editorial:update', subject: user.id, limit: 120, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const parsed = editorialStatusSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const updated = await updateEditorialNoteStatus(id, parsed.data.status)
  if (!updated) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ data: updated })
}

export const PATCH = apiHandler(updateEditorialNoteStatusHandler)
