import { NextRequest, NextResponse } from 'next/server'
import { searchAutocomplete } from '@/lib/server/search'
import { apiHandler } from '@/lib/api-handler'
import { parseAutocompleteLimit } from '@/lib/search-limit'

export const dynamic = 'force-dynamic'

async function searchHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = parseAutocompleteLimit(searchParams.get('limit'))

  if (q.length < 2) {
    return NextResponse.json({ error: 'query too short' }, { status: 400 })
  }

  if (limit === null) {
    return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 })
  }

  const results = await searchAutocomplete(q, limit)
  return NextResponse.json({ query: q, results })
}

export const GET = apiHandler(searchHandler)