import { NextResponse } from 'next/server'
import { z } from 'zod'
import { workshopApi } from '@/lib/server/highlight-api'
import { setSavedHighlight } from '@/lib/server/highlight-workshop'
export const PUT = workshopApi(async (request, { id }, userId) => {
  const { saved } = z.object({ saved: z.boolean() }).parse(await request.json())
  await setSavedHighlight(id, userId!, saved)
  return NextResponse.json({ data: { saved } })
}, true)
