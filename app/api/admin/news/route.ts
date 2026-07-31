import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import { createNewsPost, listAdminNewsPosts } from '@/lib/server/news'
import { apiHandler } from '@/lib/api-handler'
import { normalizeNewsPayload } from '@/lib/api/normalizers'

export const dynamic = 'force-dynamic'

async function getAdminNews(_request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const posts = await listAdminNewsPosts()

  return NextResponse.json(posts)
}

async function postNews(request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const normalized = normalizeNewsPayload(body)

  if ('error' in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  const post = await createNewsPost(normalized.data)

  return NextResponse.json(post, { status: 201 })
}

export const GET = apiHandler(getAdminNews)
export const POST = apiHandler(postNews)