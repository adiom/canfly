import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/server/session'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { WorkshopError } from './highlight-workshop'

export function workshopApi(handler: (request: NextRequest, ids: Record<string, string>, userId: string | null) => Promise<NextResponse>, mutation = false) {
  return apiHandler(async (request, context) => {
    try {
      const ids = (await context?.params) ?? {}
      if (Object.values(ids).some(id => !z.string().uuid().safeParse(id).success)) return NextResponse.json({ error: 'Некорректный идентификатор' }, { status: 400 })
      const user = await getCurrentUser()
      if (mutation && !user) return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 })
      if (mutation) {
        const rate = await checkRateLimit({ bucket: 'highlights:workshop', subject: user!.id, limit: 180, windowSeconds: 3600 })
        if (!rate.allowed) return rateLimitResponse(rate)
      }
      return await handler(request, ids, user?.id ?? null)
    } catch (error) {
      if (error instanceof WorkshopError) return NextResponse.json({ error: error.message }, { status: error.status })
      if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'Проверьте поля запроса' }, { status: 400 })
      throw error
    }
  })
}
