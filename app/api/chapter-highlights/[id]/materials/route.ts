import { NextResponse } from 'next/server'
import { z } from 'zod'
import { workshopApi } from '@/lib/server/highlight-api'
import { listMaterials, WorkshopError } from '@/lib/server/highlight-workshop'
export const GET = workshopApi(async (request, { id }, userId) => {
  if (!userId) throw new WorkshopError('Войдите в аккаунт', 401)
  const offset = z.coerce.number().int().min(0).max(100000).parse(request.nextUrl.searchParams.get('offset') ?? 0)
  const data = await listMaterials(id, userId, offset)
  return NextResponse.json({ data, nextOffset: data.length === 30 ? offset + 30 : null }, { headers: { 'Cache-Control': 'private, no-store' } })
})
