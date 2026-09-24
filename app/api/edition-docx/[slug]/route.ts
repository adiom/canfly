import { NextResponse, type NextRequest } from 'next/server'

import { apiHandler } from '@/lib/api-handler'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { buildEditionDocx } from '@/lib/server/edition-docx'

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Издание как документ Word. Публичный адрес — `/vvvvv/{editionSlug}.docx`
 * (rewrite в next.config.mjs), скачивается файлом, а не открывается inline:
 * `.docx` — бинарный формат, в браузере его смотреть нечего.
 */
async function getEditionDocx(
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

  const document = buildEditionDocx({
    release,
    editionSlug: edition.slug || edition.id,
    editionFormat: edition.format,
    chapters,
  })
  const filename = `${release.slug}.docx`.replace(/[^a-zA-Z0-9._-]/g, '-')

  return new NextResponse(document, {
    status: 200,
    headers: {
      'Content-Type': DOCX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
}

export const GET = apiHandler(getEditionDocx)
