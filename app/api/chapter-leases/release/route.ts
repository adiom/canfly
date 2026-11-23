import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/server/session'
import { releaseChapterLease } from '@/lib/server/chapter-leases'

/**
 * Освобождение lease при закрытии вкладки. Server Action здесь не подходит:
 * `fetch(..., { keepalive: true })` из `pagehide` должен переживать выгрузку
 * страницы, а у server action свой транспорт. Cookie-сессия проверяется
 * заново, токен lease — вторым фактором.
 */
const releaseSchema = z.object({
  chapterId: z.string().uuid(),
  sessionId: z.string().min(8).max(128),
  proof: z.object({
    sessionId: z.string().min(8).max(128),
    token: z.string().regex(/^[0-9a-f]{64}$/),
    generation: z.number().int().min(1),
  }),
})

function crossOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const allowed = process.env.NEXT_PUBLIC_BASE_URL
  if (!allowed) return true
  try {
    return new URL(origin).origin !== new URL(allowed).origin
  } catch {
    return true
  }
}

export const POST = apiHandler(async (request: NextRequest) => {
  if (crossOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = releaseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || parsed.data.sessionId !== parsed.data.proof.sessionId) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const released = await releaseChapterLease({
    chapterId: parsed.data.chapterId,
    sessionId: parsed.data.sessionId,
    actor: { userId: user.id, actorKind: 'studio' },
    proof: parsed.data.proof,
  })

  return NextResponse.json({ ok: released }, { headers: { 'Cache-Control': 'no-store' } })
})
