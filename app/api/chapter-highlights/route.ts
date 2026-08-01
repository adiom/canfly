import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/session'
import { fetchChapterHighlights, createChapterHighlight } from '@/lib/server/chapter-highlights'
import { apiHandler } from '@/lib/api-handler'
import { createHighlightSchema } from '@/lib/schemas/highlights'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

async function getChapterHighlights(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const chapterId = searchParams.get('chapterId')
  const userIdParam = searchParams.get('userId')
  const publicOnly = searchParams.get('publicOnly') === 'true'
  const limit = searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined

  if (!chapterId && !userIdParam) {
    return NextResponse.json({ error: 'chapterId or userId is required' }, { status: 400 })
  }

  const user = await getCurrentUser()

  const highlights = await fetchChapterHighlights({
    chapterId: chapterId ?? undefined,
    userId: userIdParam ?? undefined,
    publicOnly,
    currentUserId: user?.id ?? null,
    limit,
  })

  return NextResponse.json({ data: highlights })
}

async function createChapterHighlightHandler(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit({ bucket: 'highlights:create', subject: user.id, limit: 60, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const parsed = createHighlightSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid highlight', details: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data

  const highlight = await createChapterHighlight(user.id, {
    ...body,
    client_request_id: body.client_request_id ?? crypto.randomUUID(),
  })

  if (!highlight) return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  return NextResponse.json({ data: highlight })
}

export const GET = apiHandler(getChapterHighlights)
export const POST = apiHandler(createChapterHighlightHandler)
