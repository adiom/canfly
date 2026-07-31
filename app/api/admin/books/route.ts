import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import {
  createBook,
  listAdminBooks,
  updateBookCharacters,
} from '@/lib/server/books'
import { BookWithCharacters } from '@/lib/types'
import { apiHandler } from '@/lib/api-handler'
import { normalizeBookPayload } from '@/lib/api/normalizers'

export const dynamic = 'force-dynamic'

async function getAdminBooks(_request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const books = await listAdminBooks()

  return NextResponse.json(books)
}

async function postBook(request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const normalized = normalizeBookPayload(body)

  if ('error' in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  const book = await createBook(normalized.data)

  if (!book) {
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 })
  }

  await updateBookCharacters(book.id, normalized.characterIds)

  return NextResponse.json(
    {
      ...book,
      character_ids: normalized.characterIds,
    } satisfies BookWithCharacters,
    { status: 201 },
  )
}

export const GET = apiHandler(getAdminBooks)
export const POST = apiHandler(postBook)
