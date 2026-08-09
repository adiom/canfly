import { fetchChapterHighlightById } from '@/lib/server/chapter-highlights'
import { fetchChapterById } from '@/lib/server/chapters'
import { fetchEditionById } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Цитата на canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    // Тот же путь снизу вверх, что и на странице цитаты: глава → издание → релиз.
    const highlight = await fetchChapterHighlightById(id, null)
    if (!highlight?.is_public) return ogFallback()

    const chapter = await fetchChapterById(highlight.chapter_id)
    if (!chapter) return ogFallback()

    const edition = await fetchEditionById(chapter.edition_id)
    if (!edition || edition.status !== 'published') return ogFallback()

    const release = await fetchReleaseById(edition.release_id)
    if (!release || release.status !== 'published') return ogFallback()

    return ogResponse({
      kicker: 'цитата',
      title: `«${ogClamp(highlight.text_content, 180) ?? release.title}»`,
      titleSerif: true,
      note: [release.title, chapter.title].filter(Boolean).join(' · '),
    })
  } catch {
    return ogFallback()
  }
}
