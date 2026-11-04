import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { workshopApi } from '@/lib/server/highlight-api'
import { accessibleImage, WorkshopError } from '@/lib/server/highlight-workshop'
import { detectImage, MAX_IMAGE_SIZE } from '@/lib/server/image-upload'
export const GET = workshopApi(async (_request, { id, materialId }, userId) => {
  const material = await accessibleImage(id, materialId, userId)
  if (!material) throw new WorkshopError('Изображение недоступно', 404)
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  if (material.blob_path) {
    const token = process.env.HIGHLIGHT_BLOB_READ_WRITE_TOKEN
    if (!token) throw new WorkshopError('Хранилище недоступно', 503)
    const blob = await get(material.blob_path, { access: 'private', token, useCache: false })
    if (!blob || blob.statusCode !== 200) throw new WorkshopError('Изображение не найдено', 404)
    return new NextResponse(blob.stream, { headers: { ...headers, 'Content-Type': blob.blob.contentType } })
  }
  // Legacy data URIs stay owner-only; never redirect to arbitrary stored URLs.
  if (material.legacy_image_url?.startsWith('data:image/')) {
    const raw = material.legacy_image_url.split(',')[1] ?? ''
    if (raw.length > MAX_IMAGE_SIZE * 1.4) throw new WorkshopError('Изображение слишком большое')
    const bytes = Buffer.from(raw, 'base64')
    const type = detectImage(bytes)
    if (!type) throw new WorkshopError('Неизвестный формат')
    return new NextResponse(bytes, { headers: { ...headers, 'Content-Type': type.mime } })
  }
  if (material.legacy_image_url) {
    const url = new URL(material.legacy_image_url)
    if (url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com')) {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store' })
      if (!response.ok || Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_SIZE) throw new WorkshopError('Изображение недоступно', 502)
      const bytes = new Uint8Array(await response.arrayBuffer())
      const type = detectImage(bytes)
      if (!type || bytes.length > MAX_IMAGE_SIZE) throw new WorkshopError('Изображение недоступно', 502)
      return new NextResponse(bytes, { headers: { ...headers, 'Content-Type': type.mime } })
    }
  }
  throw new WorkshopError('Старое изображение нужно загрузить заново', 404)
})
