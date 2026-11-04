import { NextResponse } from 'next/server'
import { workshopApi } from '@/lib/server/highlight-api'
import { getWorkshop, saveDraft, WorkshopError } from '@/lib/server/highlight-workshop'
import { draftSchema } from '@/lib/schemas/highlight-workshop'

export const GET = workshopApi(async (_request, { id }, userId) => {
  const data = await getWorkshop(id, userId)
  if (!data) throw new WorkshopError('Карточка не найдена', 404)
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
})
export const PATCH = workshopApi(async (request, { id }, userId) => {
  return NextResponse.json({ data: await saveDraft(id, userId!, draftSchema.parse(await request.json())) })
}, true)
