import Link from 'next/link'
import type { ReleasePagePublicProps } from '@/components/release/types'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { CATALOG_PATH } from '@/lib/nav'
import { RELEASE_BLOCK_LABELS, releaseBlockOrder, type ReleaseBlock } from '@/lib/release-design'
import { ReleaseCharacters } from './release/release-characters'
import { ReleaseGames } from './release/release-games'
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
  games,
  places,
  otherSeriesReleases,
  breadcrumbs,
  preview = null,
  viewerCanEdit = false,
}: ReleasePagePublicProps & { breadcrumbs: BreadcrumbItem[] }) {
  const config = release.design_config ?? {}
  const accent = config.accent_color ?? '#d52525'
  const publishedEditions = editions.filter(edition => edition.status === 'published')
  const blocks = {
    characters: config.show_characters !== false && characters.length > 0 && <ReleaseCharacters characters={characters} />,
    games: games.length > 0 && <ReleaseGames games={games} />,
    places: places.length > 0 && (
      <div className="mx-auto max-w-6xl border-t border-cf-text-1/10 px-5 py-10 md:px-8">
        <h3 className="mb-5 text-sm font-bold text-cf-text-heading">Места в произведении</h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {places.map(place => (
            <li key={place.id}>
              <Link href={`/places/${place.slug}`} className="block h-full rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 focus-visible:outline-2">
                <span className="block font-bold">{place.name}</span>
                <span className="mt-1 block text-sm text-cf-text-2">{place.role === 'location' ? 'Место действия или упоминания' : 'Связано с произведением'}</span>
                {place.bio && <span className="mt-2 block text-sm text-cf-text-3">{place.bio}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ),
    series: config.show_series !== false && seriesLink && <ReleaseSeries series={seriesLink.series} releases={otherSeriesReleases} />,
    highlights: highlights.length > 0 && <ReleaseHighlights highlights={highlights} accent={accent} />,
  } satisfies Record<ReleaseBlock, React.ReactNode>
  const visibleBlocks = releaseBlockOrder(config.block_order)
    .filter(block => !config.hidden_blocks?.includes(block) && Boolean(blocks[block]))
  const readerEdition = !preview && editions.find(edition => edition.format === 'book' || edition.format === 'magazine')

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath={CATALOG_PATH} />
      <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8">
        <Breadcrumbs items={breadcrumbs} />
      </div>

      {preview === 'draft' && (
        <DraftBanner releaseId={release.id} viewerCanEdit={viewerCanEdit} />
      )}

      <main>
      <ReleaseHero
        release={release}
        editions={editions}
        primaryEditionSlug={primaryEditionSlug}
        seriesLink={seriesLink}
        meta={meta}
        preview={preview === 'draft'}
      />

      {visibleBlocks.length > 0 && (
        <div id="release-world" className="mx-auto max-w-6xl px-5 pb-7 md:px-8">
          <h2 className="font-serif text-3xl text-cf-text-heading">Мир произведения</h2>
          <nav aria-label="Разделы мира произведения" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {visibleBlocks.map(block => <a key={block} className="underline underline-offset-4" href={`#release-${block}`}>{RELEASE_BLOCK_LABELS[block]}</a>)}
          </nav>
        </div>
      )}
      {visibleBlocks.map(block => <div key={block} id={`release-${block}`} className="scroll-mt-24">{blocks[block]}</div>)}
      {readerEdition && !config.hidden_blocks?.includes('highlights') && (
        <section className="mx-auto max-w-6xl px-5 py-10 md:px-8" aria-labelledby="release-create-title">
          <div className="rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-5 md:p-8">
            <h2 id="release-create-title" className="font-serif text-3xl text-cf-text-heading">Создайте свою интерпретацию</h2>
            <p className="mt-2 text-sm text-cf-text-2">Откройте произведение в VVVVV, выделите фрагмент, создайте работу и поделитесь ею со ссылкой на источник.</p>
            <Link href={`/vvvvv/${readerEdition.slug}`} className="mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4">Перейти к чтению</Link>
          </div>
        </section>
      )}

      {!preview && !publishedEditions.length && (
        <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
          <div className="border-t border-cf-text-1/10 py-16 text-center text-cf-text-3">
            Пока нет доступных изданий
          </div>
        </div>
      )}
      </main>

      <SiteFooter variant="simple" />
    </div>
  )
}
