import { NextResponse, type NextRequest } from 'next/server'
import { fetchAllChaptersByEdition } from '@/lib/server/chapters'
import { fetchEditionById } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { buildEditionDocx } from '@/lib/server/edition-docx'
import { buildEditionMarkdown } from '@/lib/server/edition-markdown'
import { verifyEditionExport } from '@/lib/server/mcp-export-links'

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

/**
 * Эта ссылка — временный bearer-capability, выпускаемый только через
 * авторизованный MCP. Не используйте здесь общедоступные маршруты /vvvvv.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const { searchParams } = request.nextUrl
  const format = searchParams.get('format')
  const expires = searchParams.get('expires')
  const signature = searchParams.get('signature')

  if (!UUID.test(id) || !verifyEditionExport(id, format, expires, signature)) {
    return NextResponse.json({ error: 'Недействительная или истёкшая ссылка экспорта' }, {
      status: 403, headers: PRIVATE_HEADERS,
    })
  }

  const edition = await fetchEditionById(id)
  if (!edition) {
    return NextResponse.json({ error: 'Издание не найдено' }, {
      status: 404, headers: PRIVATE_HEADERS,
    })
  }
  // Существующие генераторы дают заглушку для не-книжных форматов.
  // Не выдаём такую заглушку за успешный экспорт текста.
  if (edition.format !== 'book') {
    return NextResponse.json({ error: 'Экспорт текста поддерживается для формата book' }, {
      status: 422, headers: PRIVATE_HEADERS,
    })
  }

  const release = await fetchReleaseById(edition.release_id)
  if (!release) {
    return NextResponse.json({ error: 'Релиз не найден' }, {
      status: 404, headers: PRIVATE_HEADERS,
    })
  }
  const chapters = await fetchAllChaptersByEdition(edition.id)
  const options = { release, editionSlug: edition.slug || edition.id, editionFormat: edition.format, chapters }
  const filename = `${edition.slug || edition.id}.${format}`.replace(/[^a-zA-Z0-9._-]/g, '-')
  const content = format === 'docx' ? buildEditionDocx(options) : buildEditionMarkdown(options)
  return new NextResponse(content, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': format === 'docx' ? DOCX_TYPE : 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
