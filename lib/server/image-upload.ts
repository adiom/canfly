import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/**
 * Разрешённые форматы и их сигнатуры. Проверяем именно байты: file.type —
 * это заголовок из multipart, который целиком задаёт клиент.
 *
 * SVG отсутствует намеренно: он проходил старую проверку
 * `file.type.startsWith('image/')`, а SVG со скриптом на публичном
 * blob-URL — это stored XSS.
 */
const SIGNATURES: { ext: string; mime: string; match: (b: Uint8Array) => boolean }[] = [
  {
    ext: 'png',
    mime: 'image/png',
    match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    // RIFF....WEBP
    ext: 'webp',
    mime: 'image/webp',
    match: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    // ....ftypavif
    ext: 'avif',
    mime: 'image/avif',
    match: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
      b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66,
  },
]

function detectImage(bytes: Uint8Array) {
  return SIGNATURES.find((sig) => sig.match(bytes)) ?? null
}

function safeFilename(name: string, ext: string) {
  const base = name
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
  return `${base || 'image'}.${ext}`
}

/**
 * Общий обработчик загрузки картинок для studio и admin.
 * Отличаются они только проверкой сессии, которую вызывающий делает сам.
 */
export async function handleImageUpload(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: `Изображение должно быть не больше ${MAX_IMAGE_SIZE / 1024 / 1024} МБ` },
      { status: 400 },
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const detected = detectImage(new Uint8Array(arrayBuffer))

  if (!detected) {
    return NextResponse.json(
      { error: 'Поддерживаются только PNG, JPEG, GIF, WebP и AVIF' },
      { status: 400 },
    )
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' }, { status: 500 })
  }

  const blob = await put(safeFilename(file.name, detected.ext), arrayBuffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType: detected.mime,
    token,
  })

  return NextResponse.json({ url: blob.url, pathname: blob.pathname })
}
