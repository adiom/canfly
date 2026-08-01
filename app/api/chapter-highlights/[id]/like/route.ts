import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/session'
import { setHighlightLike, toggleHighlightLike } from '@/lib/server/chapter-highlights'
import { apiHandler } from '@/lib/api-handler'
import { setHighlightLikeSchema } from '@/lib/schemas/highlights'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

async function toggleChapterHighlightLike(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit({ bucket: 'highlights:like', subject: user.id, limit: 300, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)

  const result = await toggleHighlightLike(id, user.id)
  if (!result) return NextResponse.json({ error: 'Not Found or Forbidden' }, { status: 404 })
  return NextResponse.json({ data: result })
}

export const POST = apiHandler(toggleChapterHighlightLike)

async function setChapterHighlightLike(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limit = await checkRateLimit({ bucket: 'highlights:like', subject: user.id, limit: 300, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const parsed = setHighlightLikeSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid like state' }, { status: 400 })
  const result = await setHighlightLike(id, user.id, parsed.data.liked)
  if (!result) return NextResponse.json({ error: 'Not Found or Forbidden' }, { status: 404 })
  return NextResponse.json({ data: result })
}

export const PUT = apiHandler(setChapterHighlightLike)
