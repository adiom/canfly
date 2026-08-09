import { fetchEditionByIdOrSlug } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { EDITION_FORMAT_LABELS, QUALITY_TIER_LABELS } from '@/lib/utils/editions'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Издание на canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const edition = await fetchEditionByIdOrSlug(slug)
    if (!edition || edition.status !== 'published') return ogFallback()

    const release = await fetchReleaseById(edition.release_id)
    if (!release || release.status !== 'published') return ogFallback()

    const format = EDITION_FORMAT_LABELS[edition.format] ?? edition.format
    // Ступень качества осмысленна только у книг — у прочих форматов она техническая.
    const tier =
      edition.format === 'book' && edition.quality_tier
        ? QUALITY_TIER_LABELS[edition.quality_tier]
        : null

    return ogResponse({
      kicker: [format, tier].filter(Boolean).join(' · '),
      title: release.title,
      note: ogClamp(release.annotation ?? release.description, 150),
      image: release.cover_image,
    })
  } catch {
    return ogFallback()
  }
}
