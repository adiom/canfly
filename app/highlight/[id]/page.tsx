import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchReleaseById } from '@/lib/server/releases'
import { fetchChapterById } from '@/lib/server/chapters'
import {
  fetchChapterHighlights,
  fetchChapterHighlightById,
} from '@/lib/server/chapter-highlights'
import type { ChapterHighlight } from '@/lib/releases-types'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { fetchEditionById, fetchEditionsByRelease } from '@/lib/server/editions'
import { getPrimaryEdition } from '@/lib/utils/editions'
import { ReleaseBookReader } from '@/components/release-book-reader'
import { HighlightScroller } from '@/components/highlight-scroller'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'
import { generateQuotationSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'
import { CATALOG_PATH } from '@/lib/nav'
import type { UserRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

interface PageProps {
  params: Promise<{ id: string }>
}

async function loadHighlightContext(highlightId: string) {
  const highlight = await fetchChapterHighlightById(highlightId, null)
  if (!highlight || !highlight.is_public) return null

  const chapter = await fetchChapterById(highlight.chapter_id)
  if (!chapter) return null

  // От главы поднимаемся к изданию и релизу — слага релиза в URL больше нет.
  const edition = await fetchEditionById(chapter.edition_id)
  if (!edition || edition.status !== 'published') return null

  const release = await fetchReleaseById(edition.release_id)
  if (!release || release.status !== 'published') return null

  return { release, highlight, chapter }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const ctx = await loadHighlightContext(id)
  if (!ctx) return notFoundMetadata('Цитата не найдена')

  const { release, highlight } = ctx
  const excerpt = highlight.text_content.slice(0, 60)

  return buildMetadata({
    title: `«${excerpt}${highlight.text_content.length > 60 ? '…' : ''}» — ${release.title}`,
    description: `Цитата из «${release.title}»${highlight.user_name ? `, автор: ${highlight.user_name}` : ''}`,
    path: `/highlight/${highlight.id}`,
    // og:image — из opengraph-image.tsx рядом: там сама цитата, а не обложка.
    generatedImage: true,
    ogType: 'article',
    publishedTime: highlight.created_at,
    modifiedTime: highlight.updated_at ?? highlight.created_at,
  })
}

export default async function HighlightSharePage({ params }: PageProps) {
  const { id } = await params
  const ctx = await loadHighlightContext(id)
  if (!ctx) notFound()

  const { release, highlight, chapter } = ctx
  const user = await getCurrentUser()
  const roles: UserRole[] = user ? await getUserRoles(user.id) : []
  const userRole = roles.find(r => ['editor', 'admin', 'author'].includes(r)) ?? (roles[0] ?? null)
  const userName = user?.display_name ?? null
  const editions = await fetchEditionsByRelease(release.id)
  const primaryEdition = getPrimaryEdition(editions)

  // Загружаем ВСЕ главы издания (для навигации в читалке)
  let chapters = primaryEdition
    ? await fetchPublishedChaptersByEdition(primaryEdition.id)
    : [chapter]

  // Загружаем highlights ВСЕХ глав (раньше грузили только первую — баг).
  // Ридер сам фильтрует по chapter_id, но данные нужны для TOC/переключения.
  let allHighlights: ChapterHighlight[] = []
  if (user && chapters.length > 0) {
    const perChapter = await Promise.all(
      chapters.map(c => fetchChapterHighlights({ chapterId: c.id, currentUserId: user.id })),
    )
    allHighlights = perChapter.flat()
  }

  // Если текущая глава не в списке — добавляем
  if (!chapters.find(c => c.id === chapter.id)) {
    chapters = [...chapters, chapter]
  }

  const quotationSchema = generateQuotationSchema({ highlight, release, chapter })
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}${CATALOG_PATH}` },
    { label: release.title, url: `${BASE_URL}/release/${release.slug}` },
    { label: 'Цитата', url: `${BASE_URL}/highlight/${highlight.id}` },
  ])

  return (
    <>
      <JsonLd schemas={[quotationSchema, breadcrumbSchema]} />
      <div className="fixed top-0 left-0 right-0 z-[60] bg-cf-bg border-b border-cf-text-1/12">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <Link href={`/release/${release.slug}`} className="text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 hover:text-cf-text-heading">
            ← {release.title}
          </Link>
          <span className="text-xs text-cf-text-3">Цитата из главы «{chapter.title}»</span>
        </div>
      </div>
      <div className="pt-12">
        {primaryEdition ? (
          <ReleaseBookReader
            release={release}
            edition={primaryEdition}
            chapters={chapters}
            currentUserId={user?.id ?? null}
            initialHighlights={allHighlights}
            userRole={userRole}
            userName={userName}
          />
        ) : (
          <div className="p-8 text-center text-cf-text-3">Издание недоступно</div>
        )}
      </div>
      <HighlightScroller highlightId={highlight.id} paragraphIndex={highlight.paragraph_index} />
    </>
  )
}