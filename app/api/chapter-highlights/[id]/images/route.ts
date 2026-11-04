import { NextResponse } from 'next/server'
import { z } from 'zod'
import { workshopApi } from '@/lib/server/highlight-api'
import { getWorkshop, WorkshopError } from '@/lib/server/highlight-workshop'
import { storeHighlightImage } from '@/lib/server/highlight-images'
export const POST = workshopApi(async (request, { id }, userId) => {
  if (!(await getWorkshop(id, userId))?.permissions.edit) throw new WorkshopError('Карточка не найдена', 404)
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new WorkshopError('Выберите изображение')
  if (file.size > 10 * 1024 * 1024) throw new WorkshopError('Размер изображения: до 10 МБ')
  const requestId = z.string().uuid().parse(form.get('requestId'))
  const caption = z.string().max(2000).parse(form.get('caption') ?? '')
  const data = await storeHighlightImage(id, userId!, new Uint8Array(await file.arrayBuffer()), requestId, 'upload', caption)
  return NextResponse.json({ data })
}, true)
