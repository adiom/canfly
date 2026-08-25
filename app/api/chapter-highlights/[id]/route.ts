import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/session'
import { updateChapterHighlight, deleteChapterHighlight, fetchChapterHighlightById } from '@/lib/server/chapter-highlights'
import { apiHandler } from '@/lib/api-handler'
import { updateHighlightSchema } from '@/lib/schemas/highlights'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

async function getChapterHighlightById(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  const highlight = await fetchChapterHighlightById(id, user?.id ?? null)
  if (!highlight) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ data: highlight })
}

async function updateChapterHighlightById(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.is_admin

  const limit = await checkRateLimit({ bucket: 'highlights:update', subject: user.id, limit: 120, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const parsed = updateHighlightSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update', details: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data
  const updated = await updateChapterHighlight(id, user.id, isAdmin, {
    note: body.note,
    is_public: body.is_public,
  })

  if (!updated) return NextResponse.json({ error: 'Not Found or Forbidden' }, { status: 404 })
  return NextResponse.json({ data: updated })
}

async function deleteChapterHighlightById(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.is_admin

  const limit = await checkRateLimit({ bucket: 'highlights:update', subject: user.id, limit: 120, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const ok = await deleteChapterHighlight(id, user.id, isAdmin)
  if (!ok) return NextResponse.json({ error: 'Not Found or Forbidden' }, { status: 404 })
  return NextResponse.json({ data: { success: true } })
}

export const GET = apiHandler(getChapterHighlightById)
export const PATCH = apiHandler(updateChapterHighlightById)
export const DELETE = apiHandler(deleteChapterHighlightById)
