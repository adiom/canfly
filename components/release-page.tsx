import Link from 'next/link'
import type { ReleasePagePublicProps } from '@/components/release/types'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { CATALOG_PATH } from '@/lib/nav'
import { ReleaseCharacters } from './release/release-characters'
import { ReleaseHighlights } from './release/release-highlights'
import { ReleaseHero } from './release/release-hero'
import { ReleaseSeries } from './release/release-series'

interface BreadcrumbItem {
  label: string
  url: string
}

function DraftBanner({ releaseId, viewerCanEdit }: { releaseId: string; viewerCanEdit: boolean }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8">
      <div
        role="status"
        className="flex flex-col gap-3 border border-cf-warm/40 bg-cf-warm/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm text-cf-text-2">
          <span className="font-black uppercase tracking-[0.14em] text-cf-warm">
            Черновик
          </span>
          <span className="mx-2 text-cf-text-3" aria-hidden>·</span>
          <span>эту версию видит только команда релиза, она не попадает в поиск и каталог.</span>
        </p>
        {viewerCanEdit && (
          <Link
            href={`/studio/releases/${releaseId}`}
            className="inline-flex items-center gap-1.5 self-start whitespace-nowrap border border-cf-text-1/15 bg-cf-text-1/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cf-text-2 transition-colors hover:border-cf-warm hover:bg-cf-warm/10 hover:text-cf-warm sm:self-auto"
          >
            Открыть в Studio
          </Link>
        )}
      </div>
    </div>
  )
}

export function ReleasePagePublic({
  release,
  editions,
  primaryEditionSlug,
  seriesLink,
  highlights,
  meta,
  characters,
  otherSeriesReleases,
  breadcrumbs,
  preview = null,
  viewerCanEdit = false,
}: ReleasePagePublicProps & { breadcrumbs: BreadcrumbItem[] }) {
  const config = release.design_config ?? {}
  const accent = config.accent_color ?? '#d52525'
  const publishedEditions = editions.filter(edition => edition.status === 'published')

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath={CATALOG_PATH} />
      <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8">
        <Breadcrumbs items={breadcrumbs} />
      </div>

      {preview === 'draft' && (
        <DraftBanner releaseId={release.id} viewerCanEdit={viewerCanEdit} />
      )}

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
