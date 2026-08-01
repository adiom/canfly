import { dbQueryOne } from '@/lib/db'
import { NextResponse } from 'next/server'

export interface RateLimitOptions {
  /** Логическая группа лимита, напр. 'llm' или 'chat' */
  bucket: string
  /** Кого ограничиваем — обычно user.id */
  subject: string
  /** Сколько обращений допускается в окне */
  limit: number
  /** Длина окна в секундах */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Через сколько секунд окно сбросится */
  resetAfter: number
}

/**
 * Фиксированное окно на Postgres. Инкремент и проверка — один атомарный
 * запрос, поэтому параллельные вызовы не проскакивают мимо лимита.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { bucket, subject, limit, windowSeconds } = options

  const row = await dbQueryOne<{ hits: number; window_start: string }>(
    `INSERT INTO rate_limits (bucket, subject, window_start, hits)
     VALUES ($1, $2, to_timestamp(floor(extract(epoch FROM NOW()) / $3) * $3), 1)
     ON CONFLICT (bucket, subject, window_start)
     DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits, window_start`,
    [bucket, subject, windowSeconds],
  )

  if (!row) {
    // Счётчик недоступен — не блокируем пользователя из-за своей же ошибки
    return { allowed: true, remaining: limit, resetAfter: windowSeconds }
  }

  const elapsed = (Date.now() - new Date(row.window_start).getTime()) / 1000
  const resetAfter = Math.max(1, Math.ceil(windowSeconds - elapsed))

  return {
    allowed: row.hits <= limit,
    remaining: Math.max(0, limit - row.hits),
    resetAfter,
  }
}

/** 429 с корректным Retry-After */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Слишком много запросов. Попробуйте позже.' },
    { status: 429, headers: { 'Retry-After': String(result.resetAfter) } },
  )
}
