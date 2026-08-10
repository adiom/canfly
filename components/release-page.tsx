import type { ReleasePagePublicProps } from '@/components/release/types'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { CATALOG_PATH } from '@/lib/nav'
import { ReleaseCharacters } from './release/release-characters'
import { ReleaseHighlights } from './release/release-highlights'
import { ReleaseHero } from './release/release-hero'
import { ReleaseSeries } from './release/release-series'

export function ReleasePagePublic({
  release,
  editions,
  primaryEditionSlug,
  seriesLink,
  highlights,
  meta,
  characters,
  otherSeriesReleases,
}: ReleasePagePublicProps) {
  const config = release.design_config ?? {}
  const accent = config.accent_color ?? '#d52525'
  const publishedEditions = editions.filter(edition => edition.status === 'published')

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath={CATALOG_PATH} />

      <ReleaseHero
        release={release}
        editions={editions}
        primaryEditionSlug={primaryEditionSlug}
        seriesLink={seriesLink}
        meta={meta}
      />

      {config.show_characters !== false && <ReleaseCharacters characters={characters} />}

      {config.show_series !== false && seriesLink && (
        <ReleaseSeries series={seriesLink.series} releases={otherSeriesReleases} />
      )}

      <ReleaseHighlights highlights={highlights} accent={accent} />

      {!publishedEditions.length && (
        <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
          <div className="border-t border-cf-text-1/10 py-16 text-center text-cf-text-3">
            Издания пока не опубликованы
          </div>
        </div>
      )}

      <SiteFooter variant="simple" />
    </div>
  )
}
