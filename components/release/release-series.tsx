import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import type { Series } from '@/lib/releases-types'
import type { OtherSeriesRelease } from './types'
import styles from './release.module.css'

export function ReleaseSeries({ series, releases }: { series: Series; releases: OtherSeriesRelease[] }) {
  return (
    <section aria-labelledby="release-series-title">
      <div className={styles.seriesHeader}>
        <div>
          <p className={styles.characterRole}>Серия</p>
          <h2 id="release-series-title" className={styles.sectionSubtitle}>{series.title}</h2>
          {series.description ? <p className={styles.seriesDescription}>{series.description}</p> : null}
        </div>
        <Link href={`/series/${series.slug}`} className={styles.textLink}>Открыть серию <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {releases.length > 0 ? (
        <ul className="mt-5 divide-y divide-cf-text-1/15 border-y border-cf-text-1/15">
          {releases.map(release => (
            <li key={release.id}>
              <Link href={`/release/${release.slug}`} className="group flex items-center gap-4 py-4 sm:gap-6">
                {release.cover_image ? (
                  <span className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-sm bg-cf-bg-2">
                    <Image src={release.cover_image} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                ) : (
                  <BookOpen size={18} aria-hidden="true" className="shrink-0 text-cf-warm" />
                )}
                <span className="min-w-0 flex-1 wrap-anywhere">
                  {release.phase_number !== null ? <span className={`${styles.caption} block`}>Том {release.phase_number}</span> : null}
                  <span className={`${styles.editionTitle} block group-hover:underline`}>{release.title}</span>
                  {release.annotation ? <span className={`${styles.caption} line-clamp-2`}>{release.annotation}</span> : null}
                </span>
                <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-cf-warm" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
