import { fetchCharacterBySlug } from '@/lib/server/characters'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Персонаж canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const data = await fetchCharacterBySlug(slug)
    const character = data?.character
    if (!character) return ogFallback()

    // Города теперь на отдельном маршруте /places
    if (character.character_type === 'city') return ogFallback()

    return ogResponse({
      kicker: 'персонаж',
      title: character.name,
      note: ogClamp(character.bio ?? character.full_description, 160),
      image: character.avatar,
      imageRounded: true,
    })
  } catch {
    return ogFallback()
  }
}
