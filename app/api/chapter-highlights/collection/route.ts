import { NextResponse } from 'next/server'
import { z } from 'zod'
import { workshopApi } from '@/lib/server/highlight-api'
import { collection, WorkshopError } from '@/lib/server/highlight-workshop'
export const GET = workshopApi(async (request, _ids, userId) => {
  if (!userId) throw new WorkshopError('Войдите в аккаунт', 401)
  const query = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0),
    saved: z.enum(['true','false']).default('false'), editionId: z.string().uuid().optional(),
  }).parse(Object.fromEntries(request.nextUrl.searchParams))
  const data = await collection(userId, query.saved === 'true', query.offset, query.editionId)
  return NextResponse.json({ data, nextOffset: data.length === 30 ? query.offset + 30 : null }, { headers: { 'Cache-Control': 'private, no-store' } })
})
