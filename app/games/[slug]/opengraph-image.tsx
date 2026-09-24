import { fetchPublishedGameBySlug } from '@/lib/server/games'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Игра canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const game = await fetchPublishedGameBySlug(slug)
    if (!game) return ogFallback()

    return ogResponse({
      kicker: 'игра',
      title: game.title,
      note: ogClamp(game.tagline ?? game.description, 160),
      image: game.cover_image,
      imageRounded: false,
    })
  } catch {
    return ogFallback()
  }
}
