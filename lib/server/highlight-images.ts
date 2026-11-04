import 'server-only'
import { put, del } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import { detectImage, MAX_IMAGE_SIZE } from './image-upload'
import { addMaterial, WorkshopError } from './highlight-workshop'

export async function storeHighlightImage(id: string, userId: string, bytes: Uint8Array, requestId: string, origin: 'upload' | 'ai', caption: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_SIZE) throw new WorkshopError('Размер изображения: до 10 МБ')
  const detected = detectImage(bytes)
  if (!detected) throw new WorkshopError('Поддерживаются PNG, JPEG, GIF, WebP и AVIF')
  const token = process.env.HIGHLIGHT_BLOB_READ_WRITE_TOKEN
  if (!token) throw new WorkshopError('Хранилище изображений пока не настроено. Текстовая мастерская доступна.', 503)
  const blob = await put(`highlights/${id}/${randomUUID()}.${detected.ext}`, Buffer.from(bytes), {
    access: 'private', token, contentType: detected.mime,
  })
  try {
    const { material, blobPath } = await addMaterial(id, userId, { kind: 'image', origin, content: caption, blobPath: blob.pathname, requestId })
    if (blobPath !== blob.pathname) await del(blob.pathname, { token }).catch(() => undefined)
    return material
  } catch (error) {
    await del(blob.pathname, { token }).catch(() => undefined)
    throw error
  }
}
