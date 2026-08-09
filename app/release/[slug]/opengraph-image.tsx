import { fetchReleaseBySlug } from '@/lib/server/releases'
import { fetchEditionsByRelease } from '@/lib/server/editions'
import { EDITION_FORMAT_LABELS } from '@/lib/utils/editions'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Релиз на canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Картинку тянут unfurl-боты мессенджеров: на любой сбой отдаём дефолт,
  // иначе вместо превью уедет 500.
  try {
    const release = await fetchReleaseBySlug(slug)
    if (!release || release.status !== 'published') return ogFallback()

    const editions = await fetchEditionsByRelease(release.id)
    const formats = [
      ...new Set(
        editions
          .filter(edition => edition.status === 'published')
          .map(edition => EDITION_FORMAT_LABELS[edition.format] ?? edition.format),
      ),
    ]

    return ogResponse({
      kicker: formats.length > 0 ? formats.join(' · ') : 'релиз',
      title: release.title,
      note: ogClamp(release.annotation ?? release.description, 150),
      image: release.cover_image,
    })
  } catch {
    return ogFallback()
  }
}
