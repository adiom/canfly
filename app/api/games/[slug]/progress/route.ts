import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { apiHandler } from '@/lib/api-handler'
import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import { getCurrentUser } from '@/lib/server/session'
import { fetchPublishedGameBySlug } from '@/lib/server/games'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ slug: string }> }

const payloadSchema = z.object({
  requestId: z.string().uuid(),
  kind: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
  score: z.number().int().min(0).max(1_000_000_000).optional(),
  details: z.record(z.unknown()).default({}),
}).strict()

const headers = { 'Cache-Control': 'no-store' }

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers })
}

async function getProgress(request: NextRequest, context: Context) {
  const user = await getCurrentUser()
  if (!user) return response({ error: 'login_required', authenticated: false }, 401)
  const { slug } = await context.params
  const game = await fetchPublishedGameBySlug(slug)
  if (!game) return response({ error: 'game_not_found' }, 404)

  const [score, events] = await Promise.all([
    dbQueryOne<{ last_score: number | null; best_score: number | null; updated_at: string }>(
      'SELECT last_score, best_score, updated_at FROM game_user_scores WHERE game_id = $1 AND user_id = $2',
      [game.id, user.id],
    ),
    dbQuery<{ id: string; kind: string; score: number | null; details: Record<string, unknown>; created_at: string }>(
      `SELECT id::text, kind, score, details, created_at FROM game_user_events
       WHERE game_id = $1 AND user_id = $2 ORDER BY created_at DESC, id DESC LIMIT 20`,
      [game.id, user.id],
    ),
  ])
  return response({
    authenticated: true,
    user: { id: user.id, name: user.display_name },
    game: slug,
    lastScore: score?.last_score ?? null,
    bestScore: score?.best_score ?? null,
    updatedAt: score?.updated_at ?? null,
    history: events,
  })
}

async function postProgress(request: NextRequest, context: Context) {
  // Cookies authenticate requests; reject cross-origin POSTs and requests without Origin.
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) {
    return response({ error: 'invalid_origin' }, 403)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'json_required' }, 415)
  }
  const user = await getCurrentUser()
  if (!user) return response({ error: 'login_required', authenticated: false }, 401)
  const { slug } = await context.params
  const game = await fetchPublishedGameBySlug(slug)
  if (!game) return response({ error: 'game_not_found' }, 404)

  const body = await request.text()
  if (body.length > 4096) return response({ error: 'payload_too_large' }, 413)

  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return response({ error: 'invalid_json' }, 400) }
  const validation = payloadSchema.safeParse(parsed)
  if (!validation.success) return response({ error: 'invalid_payload' }, 400)

  const { requestId, kind, score, details } = validation.data
  if (JSON.stringify(details).length > 2048) return response({ error: 'details_too_large' }, 413)

  const limit = await checkRateLimit({
    bucket: 'game:progress',
    subject: user.id,
    limit: 120,
    windowSeconds: 3600,
  })
  if (!limit.allowed) return rateLimitResponse(limit)

  // Duplicate requestIds are ignored, including score changes: safe retries.
  const saved = await withTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO game_user_events (game_id, user_id, request_id, kind, score, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (game_id, user_id, request_id) DO NOTHING
       RETURNING id::text`,
      [game.id, user.id, requestId, kind, score ?? null, JSON.stringify(details)],
    )
    if (!inserted.rows.length) return false
    if (score !== undefined) {
      await client.query(
        `INSERT INTO game_user_scores (game_id, user_id, last_score, best_score)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (game_id, user_id) DO UPDATE SET
           last_score = EXCLUDED.last_score,
           best_score = GREATEST(game_user_scores.best_score, EXCLUDED.best_score),
           updated_at = NOW()`,
        [game.id, user.id, score],
      )
    }
    return true
  })
  return response({ ok: true, saved, game: slug }, saved ? 201 : 200)
}

export const GET = apiHandler(getProgress)
export const POST = apiHandler(postProgress)
