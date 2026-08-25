import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/session'
import { deleteEditorialNote, canManageChapterEditorialNotes, fetchEditorialNoteChapterId } from '@/lib/server/chapter-highlights'
import { apiHandler } from '@/lib/api-handler'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

async function deleteEditorialNoteHandler(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.is_admin
  const chapterId = await fetchEditorialNoteChapterId(id)
  if (!chapterId) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  const allowed = await canManageChapterEditorialNotes(chapterId, user.id, isAdmin)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const limit = await checkRateLimit({ bucket: 'editorial:update', subject: user.id, limit: 120, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)

  const deleted = await deleteEditorialNote(id, user.id, isAdmin)
  if (!deleted) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ data: { id } })
}

export const DELETE = apiHandler(deleteEditorialNoteHandler)
