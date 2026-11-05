import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Series } from '@/lib/releases-types'
import type { OtherSeriesRelease } from './types'
import { ReleaseDescription } from './release-description'
import styles from './release.module.css'

function SeriesItem({ release }: { release: OtherSeriesRelease }) {
  return <li className={styles.seriesItem}>
    {release.cover_image ? <Link href={`/release/${release.slug}`} className={styles.seriesCover} aria-label={release.title}>
      <Image src={release.cover_image} alt="" fill sizes="52px" className="object-cover" />
    </Link> : null}
    <div className={styles.seriesInfo}>
      <h3><Link href={`/release/${release.slug}`}>{release.title}</Link></h3>
      {release.phase_number !== null ? <p className={styles.caption}>Том {release.phase_number}</p> : null}
      {release.annotation ? <ReleaseDescription text={release.annotation} limit={100} /> : null}
    </div>
  </li>
}

export function ReleaseSeries({ series, releases }: { series: Series; releases: OtherSeriesRelease[] }) {
  return <section aria-labelledby="release-series-title">
    <div className={styles.seriesHeader}>
      <p className={styles.characterRole}>Серия</p>
      <h2 id="release-series-title" className={styles.sectionSubtitle}>{series.title}</h2>
      {series.description ? <ReleaseDescription text={series.description} limit={180} /> : null}
      <Link href={`/series/${series.slug}`} className={styles.textLink}>Открыть серию<ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
    {releases.length > 0 ? <ul className={styles.seriesList}>{releases.slice(0, 3).map(release => <SeriesItem key={release.id} release={release} />)}</ul> : null}
    {releases.length > 3 ? <details className={styles.more}><summary>Ещё произведения · {releases.length - 3}</summary>
      <ul>{releases.slice(3).map(release => <SeriesItem key={release.id} release={release} />)}</ul>
    </details> : null}
  </section>
}
