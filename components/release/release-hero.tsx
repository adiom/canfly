import Image from 'next/image'
import Link from 'next/link'
import type { ReleasePagePublicProps } from './types'
import { ReleaseStudioLink } from './release-studio-link'
import styles from './release.module.css'

type Props = Pick<ReleasePagePublicProps, 'release' | 'seriesLink' | 'preview'>

export function ReleaseHero({ release, seriesLink, preview }: Props) {
  const annotation = (release.annotation || release.description || '').trim()
  const first = annotation.split(/\n/).filter(Boolean)[0] ?? ''
  const end = first.length > 360 ? first.lastIndexOf(' ', 360) : first.length
  const introduction = first.slice(0, end > 0 ? end : 360)
  const remainder = annotation.slice(introduction.length).trim()
  return <section className={styles.hero} data-cover={Boolean(release.cover_image)} aria-labelledby="release-title">
    {release.cover_image ? <figure className={styles.stage}>
      <Image src={release.cover_image} alt={`Обложка «${release.title}»`} width={160} height={240}
        sizes="(max-width: 480px) 104px, 160px" className={styles.cover} loading="eager" fetchPriority="high" />
    </figure> : null}
    <div className={styles.identity}>
      <h1 id="release-title" className={styles.title}>{release.title}</h1>
      {release.authors.length > 0 ? <p className={styles.authors}>{release.authors.map(author => author.name).join(', ')}</p> : null}
      {seriesLink ? <Link href={`/series/${seriesLink.series.slug}`} className={styles.seriesLink}>
        Серия «{seriesLink.series.title}»{seriesLink.phase_number !== null ? ` · Том ${seriesLink.phase_number}` : ''}
      </Link> : null}
      {introduction ? <p className={styles.annotation}>{introduction}</p> : null}
      {remainder ? <details className={styles.annotationMore}><summary>Полная аннотация</summary><p>{remainder}</p></details> : null}
      {!preview ? <ReleaseStudioLink releaseId={release.id} /> : null}
    </div>
  </section>
}
