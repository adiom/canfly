import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import type { ReleasePagePublicProps } from '@/components/release/types'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { CATALOG_PATH } from '@/lib/nav'
import { isDigitalFormat } from '@/lib/utils/editions'
import { ReleaseCharacters } from './release/release-characters'
import { ReleaseGames } from './release/release-games'
import { ReleaseHighlights } from './release/release-highlights'
import { ReleaseHero } from './release/release-hero'
import { ReleaseEditions, ReleaseExternalEditions } from './release/release-editions'
import { ReleaseSeries } from './release/release-series'
import styles from './release/release.module.css'

type Props = ReleasePagePublicProps & { breadcrumbs: Array<{ label: string; url: string }> }

export function ReleasePagePublic({ release, editions, primaryEditionSlug, seriesLink, highlights, meta, characters, games, places,
  otherSeriesReleases, breadcrumbs, preview = null, viewerCanEdit = false }: Props) {
  const internal = editions.filter(edition => preview || !isDigitalFormat(edition.format))
  const primary = internal.find(edition => edition.slug === primaryEditionSlug)
  const ordered = primary ? [primary, ...internal.filter(edition => edition.id !== primary.id)] : internal
  const reader = !preview ? internal.find(edition => edition.status === 'published' && (edition.format === 'book' || edition.format === 'magazine')) : null
  const context = Boolean(seriesLink || games.length || places.length)
  return <div className={`release-surface ${styles.surface}`}>
    <SiteHeader activePath={CATALOG_PATH} releaseLayout />
    <div className={styles.frame}><main className={styles.content}>
      <div className={styles.breadcrumbs}><Breadcrumbs items={breadcrumbs} /></div>
      {preview ? <div role="status" className={styles.draft}>
        <p><strong>Черновик</strong> — эту версию видит только команда релиза, она не попадает в поиск и каталог.</p>
        {viewerCanEdit ? <Link href={`/studio/releases/${release.id}`}>Открыть в Studio</Link> : null}
      </div> : null}
      <ReleaseHero release={release} seriesLink={seriesLink} preview={preview} />
      <ReleaseEditions editions={ordered} preview={Boolean(preview)} primaryEditionSlug={primaryEditionSlug} meta={meta} />
      {!preview && editions.length === 0 ? <p className={styles.caption}>Пока нет доступных изданий</p> : null}
      {(characters.length > 0 || highlights.length > 0 || context) ? <div className={styles.workspace} data-context={context}>
        <div className={styles.mainColumn}>
          {characters.length > 0 ? <div id="release-characters" className={styles.module}><ReleaseCharacters characters={characters} /></div> : null}
          {highlights.length > 0 ? <div id="release-highlights" className={styles.module}><ReleaseHighlights highlights={highlights} /></div> : null}
        </div>
        {context ? <aside className={styles.context} aria-label="Контекст релиза">
          {seriesLink ? <div id="release-series" className={styles.module}><ReleaseSeries series={seriesLink.series} releases={otherSeriesReleases} /></div> : null}
          {games.length > 0 ? <div id="release-games" className={styles.module}><ReleaseGames games={games} /></div> : null}
          {places.length > 0 ? <section id="release-places" className={styles.module} aria-labelledby="release-places-title">
            <h2 id="release-places-title" className={styles.sectionSubtitle}>Места в произведении</h2>
            <ul>{places.map(place => <li className={styles.place} key={place.id}>
              <Link href={`/places/${place.slug}`} className={styles.textLink}><MapPin size={16} aria-hidden="true" />{place.name}</Link>
              {place.bio ? <details className={styles.description}><summary>Описание места</summary><p>{place.bio}</p></details> : null}
            </li>)}</ul>
          </section> : null}
        </aside> : null}
      </div> : null}
      {reader ? <Link href={`/vvvvv/${reader.slug}`} className={styles.textLink}>
        Создать свою интерпретацию в VVVVV<ArrowRight size={16} aria-hidden="true" />
      </Link> : null}
      {!preview ? <ReleaseExternalEditions editions={editions.filter(edition => isDigitalFormat(edition.format))} /> : null}
    </main></div>
    <SiteFooter variant="simple" />
  </div>
}
