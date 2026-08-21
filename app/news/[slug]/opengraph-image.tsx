import { fetchNewsPostBySlug, fetchNewsPostById } from '@/lib/server/news'
import { stripHtml } from '@/lib/seo/metadata'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Новость canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const post = UUID_RE.test(slug)
      ? await fetchNewsPostById(slug)
      : await fetchNewsPostBySlug(slug)
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
