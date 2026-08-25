import { fetchUserByHandle } from '@/lib/server/user-profile'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Профиль canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const user = await fetchUserByHandle(slug)
    // Закрытый профиль не должен утекать превью — отдаём дефолтную картинку.
    if (!user || !user.profile_is_public) return ogFallback()

    return ogResponse({
      kicker: `@${user.handle}`,
      title: user.display_name,
      note: ogClamp(user.tagline ?? user.bio, 150),
      image: user.avatar,
      imageRounded: true,
    })
  } catch {
    return ogFallback()
  }
}
