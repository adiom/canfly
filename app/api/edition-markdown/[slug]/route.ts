import { NextResponse, type NextRequest } from 'next/server'

import { apiHandler } from '@/lib/api-handler'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { buildEditionMarkdown } from '@/lib/server/edition-markdown'

async function getEditionMarkdown(
  _request: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const { slug } = await params
  const edition = await fetchEditionByIdOrSlug(slug)

  if (!edition || edition.status !== 'published') {
    return NextResponse.json({ error: 'Издание не найдено или не опубликовано' }, { status: 404 })
  }

  const [release, chapters] = await Promise.all([
    fetchReleaseById(edition.release_id),
    fetchPublishedChaptersByEdition(edition.id),
  ])

  if (!release || release.status !== 'published') {
    return NextResponse.json({ error: 'Релиз не найден или не опубликован' }, { status: 404 })
  }

  const markdown = buildEditionMarkdown({
    release,
    editionSlug: edition.slug || edition.id,
    editionFormat: edition.format,
    chapters,
  })
  const filename = `${release.slug}.md`.replace(/[^a-zA-Z0-9._-]/g, '-')

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
}

export const GET = apiHandler(getEditionMarkdown)
