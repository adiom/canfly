import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown } from 'lucide-react'
import type { ReleasePagePublicProps } from './types'
import { EditionLink, ReleaseEditions } from './release-editions'
import { ReleaseHeroArt } from './release-hero-art'
import { ReleaseStudioLink } from './release-studio-link'
import { EDITION_FORMAT_LABELS, formatTotalDuration, isAudioFormat } from '@/lib/utils/editions'
import { formatChapterCount, formatReadingTime, formatWordCount } from '@/lib/utils/format'
import styles from './release.module.css'

type ReleaseHeroProps = Pick<ReleasePagePublicProps, 'release' | 'editions' | 'primaryEditionSlug' | 'seriesLink' | 'meta' | 'preview'> & {
  showSeries: boolean
}

export function ReleaseHero({ release, editions, primaryEditionSlug, seriesLink, meta, preview, showSeries }: ReleaseHeroProps) {
  const config = release.design_config ?? {}
  const heroStyle = config.hero_style ?? 'full'
  const annotation = release.annotation || release.description
  const shortAnnotation = annotation && annotation.length > 280
    ? `${annotation.slice(0, 280).replace(/\s+\S*$/, '')}…`
    : annotation
  const cover = heroStyle === 'minimal' ? null : release.cover_image
  const art = heroStyle !== 'minimal' && (config.hero_art === 'svg' || config.hero_art === 'canvas') ? config.hero_art : null
  const primary = editions.find(edition => edition.slug === primaryEditionSlug)
  const alternatives = primary ? editions.filter(edition => edition.id !== primary.id) : editions
  const audio = primary ? isAudioFormat(primary.format) : false
  const text = primary?.format === 'book' || primary?.format === 'magazine'
  const series = showSeries ? seriesLink : null
  const details = [
    meta.chapterCount > 0 ? formatChapterCount(meta.chapterCount, audio) : null,
    audio && meta.durationSeconds > 0 ? formatTotalDuration(meta.durationSeconds) : null,
    text && meta.wordCount > 0 ? formatWordCount(meta.wordCount) : null,
    text && meta.readingMinutes > 0 ? formatReadingTime(meta.readingMinutes) : null,
  ].filter(Boolean)
  const format = primary ? EDITION_FORMAT_LABELS[primary.format] : null

  return (
    <>
      <section
        className={`release-container ${styles.container} ${styles.hero}`}
        aria-labelledby="release-title"
        data-release-hero={heroStyle}
        data-cover={Boolean(cover || art)}
      >
        <div className={styles.identity}>
          <h1 id="release-title" className={styles.title}>{release.title}</h1>
          {release.authors.length > 0 ? (
            <p className={styles.authors}>{release.authors.map(author => author.name).join(', ')}</p>
          ) : null}
          {series ? (
            <a className={styles.seriesLink} href="#release-series">
              Серия «{series.series.title}»{series.phase_number !== null ? ` · Том ${series.phase_number}` : ''}
              <ArrowDown size={14} aria-hidden="true" />
            </a>
          ) : null}
          {format || release.genre ? (
            <ul className={styles.kinds} aria-label="Формат и жанр">
              {format ? <li>{format}</li> : null}
              {release.genre ? <li>{release.genre}</li> : null}
            </ul>
          ) : null}
        </div>

        {cover || art ? (
          <figure className={styles.stage} data-art-only={!cover}>
            {cover ? (
              <div className={styles.cover} data-overlay={config.hero_overlay ?? 'none'}>
                <Image
                  src={cover}
                  alt={`Обложка «${release.title}»`}
                  fill
                  sizes={heroStyle === 'centered'
                    ? '(max-width: 480px) 54vw, 264px'
                    : '(max-width: 767px) 116px, (max-width: 1100px) 30vw, 356px'}
                  className={config.cover_fit === 'contain' ? 'object-contain' : 'object-cover'}
                  fetchPriority="high"
                  loading="eager"
                />
              </div>
            ) : null}
            {art ? <ReleaseHeroArt key={art} mode={art} /> : null}
            {cover && series?.phase_number != null ? (
              <figcaption className={styles.coverCaption}>Том {series.phase_number} / {series.series.title}</figcaption>
            ) : null}
          </figure>
        ) : null}

        <div className={styles.details}>
          {shortAnnotation ? <p className={styles.annotation}>{shortAnnotation}</p> : null}
          {annotation && shortAnnotation !== annotation ? (
            <details className={styles.annotationMore}>
              <summary>Полное описание</summary>
              <p>{annotation}</p>
            </details>
          ) : null}
          {details.length > 0 ? (
            <ul className={styles.facts} aria-label="Объём основного издания">
              {details.map(item => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
          {!preview && primary ? (
            <div className={styles.actions}>
              <EditionLink edition={primary} primary />
              {alternatives.length === 1 ? <EditionLink edition={alternatives[0]} /> : null}
              {alternatives.length > 1 ? (
                <Link href="#release-editions" className={styles.action}>Другие форматы <ArrowDown size={18} aria-hidden="true" /></Link>
              ) : null}
            </div>
          ) : null}
          {!preview && !primary ? <p className={styles.unavailable}>Пока нет доступных изданий</p> : null}
          {!preview ? <ReleaseStudioLink releaseId={release.id} /> : null}
        </div>
      </section>

      {editions.length > 0 && (preview || editions.length > 1) ? (
        <ReleaseEditions editions={primary ? [primary, ...alternatives] : editions} preview={Boolean(preview)} />
      ) : null}
    </>
  )
}
