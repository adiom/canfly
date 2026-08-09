import { fetchNewsPostById } from '@/lib/server/news'
import { stripHtml } from '@/lib/seo/metadata'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Новость canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const post = await fetchNewsPostById(id)
    if (!post || post.status !== 'published') return ogFallback()

    return ogResponse({
      kicker: [post.section, post.tag].filter(Boolean).join(' · ') || 'новости',
      title: post.title,
      // content — HTML, в картинку он должен попасть уже без тегов.
      note: ogClamp(stripHtml(post.content), 170),
      image: post.cover_image,
    })
  } catch {
    return ogFallback()
  }
}
