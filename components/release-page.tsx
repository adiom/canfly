import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ReleasePagePublicProps } from '@/components/release/types'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { CATALOG_PATH } from '@/lib/nav'
import { RELEASE_DESIGN_DEFAULTS, releaseBlockOrder, type ReleaseBlock } from '@/lib/release-design'
import { ReleaseCharacters } from './release/release-characters'
import { ReleaseGames } from './release/release-games'
import { ReleaseHighlights } from './release/release-highlights'
import { ReleaseHero } from './release/release-hero'
import { ReleaseSeries } from './release/release-series'
import { ReleaseWorldExplorer } from './release/release-world-explorer'
import styles from './release/release.module.css'

interface BreadcrumbItem {
  label: string
  url: string
}

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i

function getReleaseColor(value: string | undefined, fallback: string) {
  return value && HEX_COLOR_PATTERN.test(value) ? value : fallback
}

function DraftBanner({ releaseId, viewerCanEdit }: { releaseId: string; viewerCanEdit: boolean }) {
  return (
    <div className={`${styles.container} pt-4`}>
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
  games,
  places,
  otherSeriesReleases,
  breadcrumbs,
  preview = null,
  viewerCanEdit = false,
}: ReleasePagePublicProps & { breadcrumbs: BreadcrumbItem[] }) {
  const config = release.design_config ?? {}
  const accent = getReleaseColor(config.accent_color, RELEASE_DESIGN_DEFAULTS.accent_color)
  const background = getReleaseColor(config.bg_color, RELEASE_DESIGN_DEFAULTS.bg_color)
  const text = getReleaseColor(config.text_color, RELEASE_DESIGN_DEFAULTS.text_color)
  const designStyle = {
    '--cf-bg': background,
    '--cf-bg-2': `color-mix(in srgb, ${background} 92%, ${text})`,
    '--cf-footer-bg': `color-mix(in srgb, ${background} 86%, ${text})`,
    '--cf-text-1': text,
    '--cf-text-2': `color-mix(in srgb, ${text} 82%, ${background})`,
    '--cf-text-3': `color-mix(in srgb, ${text} 64%, ${background})`,
    '--cf-text-4': `color-mix(in srgb, ${text} 48%, ${background})`,
    '--cf-text-heading': text,
    '--cf-text-caption': `color-mix(in srgb, ${text} 78%, ${background})`,
    '--cf-accent': accent,
    '--cf-accent-hover': `color-mix(in srgb, ${accent} 82%, ${text})`,
    '--cf-warm': `color-mix(in srgb, ${accent} 78%, ${text})`,
  } as CSSProperties
  const publishedEditions = editions.filter(edition => edition.status === 'published')
  const blocks = {
    characters: config.show_characters !== false && characters.length > 0 && <ReleaseCharacters characters={characters} />,
    games: games.length > 0 && <ReleaseGames games={games} />,
    places: places.length > 0 && (
      <section aria-labelledby="release-places-title">
        <h2 id="release-places-title" className={styles.sectionSubtitle}>Места в произведении</h2>
        <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
          {places.map(place => (
            <li key={place.id} className="border-t border-cf-text-1/15">
              <Link href={`/places/${place.slug}`} className="group flex items-start gap-3 py-4">
                <MapPin size={18} aria-hidden="true" className="mt-1 shrink-0 text-cf-warm" />
                <span className="min-w-0 wrap-anywhere">
                  <span className={`${styles.editionTitle} block group-hover:underline`}>{place.name}</span>
                  <span className={`${styles.caption} block`}>{place.role === 'location' ? 'Место действия или упоминания' : 'Связано с произведением'}</span>
                  {place.bio ? <span className={`${styles.caption} mt-2 line-clamp-3`}>{place.bio}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ),
    series: config.show_series !== false && seriesLink && <ReleaseSeries series={seriesLink.series} releases={otherSeriesReleases} />,
    highlights: highlights.length > 3 && <ReleaseHighlights highlights={highlights.slice(3)} />,
  } satisfies Record<ReleaseBlock, React.ReactNode>
  const visibleBlocks = releaseBlockOrder(config.block_order)
    .filter(block => !config.hidden_blocks?.includes(block) && Boolean(blocks[block]))
  const showSeries = visibleBlocks.includes('series')
  const readerEditions = publishedEditions.filter(edition => edition.format === 'book' || edition.format === 'magazine')
  const readerEdition = readerEditions.find(edition => edition.slug === primaryEditionSlug) ?? readerEditions[0]
  const canCreate = !preview && readerEdition && !config.hidden_blocks?.includes('highlights')
  const showHighlights = !config.hidden_blocks?.includes('highlights') && highlights.length > 0

  return (
    <div className={`release-surface ${styles.surface} min-h-screen bg-cf-bg text-cf-text-1`} style={designStyle}>
      <SiteHeader activePath={CATALOG_PATH} />
      <div className={`${styles.container} ${styles.breadcrumbs}`}>
        <Breadcrumbs items={breadcrumbs} />
      </div>

      {preview === 'draft' && (
        <DraftBanner releaseId={release.id} viewerCanEdit={viewerCanEdit} />
      )}

      <main className="release-content" data-release-layout={config.layout ?? RELEASE_DESIGN_DEFAULTS.layout}>
        <ReleaseHero
          release={release}
          editions={editions}
          primaryEditionSlug={primaryEditionSlug}
          seriesLink={seriesLink}
          showSeries={showSeries}
          meta={meta}
          preview={preview}
        />

        {showHighlights ? (
          <div className={`release-container ${styles.container} pb-7`}>
            <ReleaseWorldExplorer
              title={release.title}
              highlights={highlights.slice(0, 3)}
            />
          </div>
        ) : null}

        {visibleBlocks.length > 0 || canCreate ? (
          <div className={`release-body release-container ${styles.container} pb-14`} data-release-toc="false">
            <div className="min-w-0">
              {visibleBlocks.map(block => (
                <div key={block} id={`release-${block}`} className={block === 'highlights' ? styles.community : styles.module}>
                  {blocks[block]}
                </div>
              ))}
              {canCreate ? (
                <section className={styles.return} aria-labelledby="release-create-title">
                  <h2 id="release-create-title" className={styles.sectionSubtitle}>Создайте свою интерпретацию</h2>
                  <p className={`${styles.caption} mt-2 max-w-[54ch] text-base`}>Выделите фрагмент в VVVVV, откройте мастерскую и опубликуйте свою работу со ссылкой на источник.</p>
                  <Link href={`/vvvvv/${readerEdition.slug}`} className={`${styles.textLink} mt-2`}>Перейти к чтению <ArrowRight size={16} aria-hidden="true" /></Link>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>

      <SiteFooter variant="simple" />
    </div>
  )
}
