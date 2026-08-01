import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { fetchChapterEditorialNotes, createEditorialNote, canManageChapterEditorialNotes } from '@/lib/server/chapter-highlights'
import { apiHandler } from '@/lib/api-handler'
import { createEditorialNoteSchema } from '@/lib/schemas/highlights'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

async function getChapterEditorialNotes(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const chapterId = searchParams.get('chapterId')
  if (!chapterId) return NextResponse.json({ error: 'chapterId required' }, { status: 400 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roles = await getUserRoles(user.id)
  const allowed = await canManageChapterEditorialNotes(chapterId, user.id, roles.includes('admin'))
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const notes = await fetchChapterEditorialNotes(chapterId)
  return NextResponse.json({ data: notes })
}

async function createEditorialNoteHandler(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roles = await getUserRoles(user.id)
  const limit = await checkRateLimit({ bucket: 'editorial:create', subject: user.id, limit: 60, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const parsed = createEditorialNoteSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid editorial note', details: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data
  const allowed = await canManageChapterEditorialNotes(body.chapter_id, user.id, roles.includes('admin'))
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const created = await createEditorialNote(user.id, {
    ...body,
    client_request_id: body.client_request_id ?? crypto.randomUUID(),
  })

  return NextResponse.json({ data: created })
}

export const GET = apiHandler(getChapterEditorialNotes)
export const POST = apiHandler(createEditorialNoteHandler)
