import { NextResponse, type NextRequest } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { getV2FeedPage, InvalidFeedCursor } from '@/lib/server/v2-feed'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async (request: NextRequest) => {
  try {
    const page = await getV2FeedPage(request.nextUrl.searchParams.get('cursor'))
    return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  } catch (error) {
    if (error instanceof InvalidFeedCursor) return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }
})
