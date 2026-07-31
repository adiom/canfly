import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import {
  deleteBook,
  fetchBookById,
  getBookCharacterIds,
  updateBook,
  updateBookCharacters,
} from '@/lib/server/books'
import { BookWithCharacters } from '@/lib/types'
import { apiHandler } from '@/lib/api-handler'
import { normalizeBookPayload } from '@/lib/api/normalizers'

export const dynamic = 'force-dynamic'

async function getAdminBook(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params as { id: string }
  const book = await fetchBookById(id)

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  const characterIds = await getBookCharacterIds(id)

  return NextResponse.json({
    ...book,
    character_ids: characterIds,
  } satisfies BookWithCharacters)
}

async function updateAdminBook(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params as { id: string }
  const body = await request.json()
  const normalized = normalizeBookPayload(body)

  if ('error' in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  const book = await updateBook(id, normalized.data)

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  await updateBookCharacters(id, normalized.characterIds)

  return NextResponse.json({
    ...book,
    character_ids: normalized.characterIds,
  } satisfies BookWithCharacters)
}

async function deleteAdminBook(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params as { id: string }

  await deleteBook(id)

  return NextResponse.json({ ok: true })
}

export const GET = apiHandler(getAdminBook)
export const PATCH = apiHandler(updateAdminBook)
export const DELETE = apiHandler(deleteAdminBook)