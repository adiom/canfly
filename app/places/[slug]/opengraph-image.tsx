import { fetchPlaceBySlug } from '@/lib/server/places'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Место canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const place = await fetchPlaceBySlug(slug)
    if (!place) return ogFallback()

    return ogResponse({
      kicker: 'место',
      title: place.name,
      note: ogClamp(place.bio ?? place.full_description, 160),
      image: place.avatar,
      imageRounded: false,
    })
  } catch {
    return ogFallback()
  }
}
