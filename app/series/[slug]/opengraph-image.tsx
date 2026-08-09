import { fetchSeriesWithReleases } from '@/lib/server/series'
import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback, ogClamp } from '@/lib/seo/og-shared'

export const alt = 'Серия на canfly'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

function releasesLabel(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return `${count} релизов`
  if (mod10 === 1) return `${count} релиз`
  if (mod10 >= 2 && mod10 <= 4) return `${count} релиза`
  return `${count} релизов`
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const series = await fetchSeriesWithReleases(slug)
    if (!series) return ogFallback()

    return ogResponse({
      kicker: `серия · ${releasesLabel(series.releases.length)}`,
      title: series.title,
      note: ogClamp(series.description, 150),
      image: series.releases.find(release => release.cover_image)?.cover_image ?? null,
    })
  } catch {
    return ogFallback()
  }
}
