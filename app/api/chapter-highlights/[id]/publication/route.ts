import { NextResponse } from 'next/server'
import { workshopApi } from '@/lib/server/highlight-api'
import { publishWorkshop } from '@/lib/server/highlight-workshop'
import { publicationSchema } from '@/lib/schemas/highlight-workshop'
export const PUT = workshopApi(async (request, { id }, userId) =>
  NextResponse.json({ data: await publishWorkshop(id, userId!, publicationSchema.parse(await request.json())) }), true)
