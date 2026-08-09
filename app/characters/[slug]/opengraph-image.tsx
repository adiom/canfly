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

    const isCity = character.character_type === 'city'

    return ogResponse({
      kicker: isCity ? 'место' : 'персонаж',
      title: character.name,
      note: ogClamp(character.bio ?? character.full_description, 160),
      image: character.avatar,
      // Города показываем прямоугольником: круг читается как портрет.
      imageRounded: !isCity,
    })
  } catch {
    return ogFallback()
  }
}
