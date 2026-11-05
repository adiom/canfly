import Link from 'next/link'
import { ArrowRight, BookOpen, ExternalLink, Headphones, ImageIcon } from 'lucide-react'
import type { Edition } from '@/lib/releases-types'
import { EDITION_FORMAT_LABELS, getEditionAction, isAudioFormat, isDigitalFormat, isExternalEditionUrl, QUALITY_TIER_LABELS, formatTotalDuration } from '@/lib/utils/editions'
import { formatChapterCount, formatReadingTime, formatWordCount } from '@/lib/utils/format'
import type { ReleaseMeta } from './types'
import styles from './release.module.css'

export function EditionLink({ edition, primary = false, compact = false }: { edition: Edition; primary?: boolean; compact?: boolean }) {
  const external = isDigitalFormat(edition.format)
  if (external && !isExternalEditionUrl(edition.external_url)) return null
  const label = edition.format === 'comic' ? 'Читать комикс'
    : edition.format === 'book' || edition.format === 'magazine' ? primary ? 'Начать читать' : 'Читать в VVVVV'
      : getEditionAction(edition)
  const Icon = external ? ExternalLink : ArrowRight
  return <Link href={external && edition.external_url ? edition.external_url : `/vvvvv/${edition.slug}`}
    target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
    className={compact ? styles.textLink : styles.action} data-primary={primary}
    data-metrika-goal={external ? 'external_edition_open' : 'edition_open'}>
    {label}<Icon size={compact ? 16 : 18} aria-hidden="true" />
  </Link>
}

export function ReleaseEditions({ editions, preview, primaryEditionSlug, meta }: {
  editions: Edition[]; preview: boolean; primaryEditionSlug?: string | null; meta?: ReleaseMeta
}) {
  if (editions.length === 0) return null
  return <section className={styles.editions} id="release-editions" aria-labelledby="release-editions-title">
    <h2 className={styles.sectionTitle} id="release-editions-title">Издания</h2>
    <ul>{editions.map((edition, index) => {
      const audio = isAudioFormat(edition.format)
      const text = edition.format === 'book' || edition.format === 'magazine'
      const Icon = isDigitalFormat(edition.format) ? ExternalLink : audio ? Headphones : edition.format === 'artwork' ? ImageIcon : BookOpen
      const facts = edition.slug === primaryEditionSlug && meta ? [
        meta.chapterCount > 0 ? formatChapterCount(meta.chapterCount, audio) : null,
        text && meta.wordCount > 0 ? formatWordCount(meta.wordCount) : null,
        text && meta.readingMinutes > 0 ? formatReadingTime(meta.readingMinutes) : null,
        audio && meta.durationSeconds > 0 ? formatTotalDuration(meta.durationSeconds) : null,
      ].filter(Boolean) : []
      return <li className={styles.edition} key={edition.id}>
        <Icon size={22} aria-hidden="true" />
        <div className={styles.editionInfo}>
          <p className={styles.editionTitle}>{EDITION_FORMAT_LABELS[edition.format]}</p>
          {edition.format === 'book' ? <p className={styles.caption}>{QUALITY_TIER_LABELS[edition.quality_tier]}</p> : null}
          {preview ? <p className={styles.caption}>{edition.status === 'draft' ? 'Черновик издания' : 'Опубликовано'}</p> : null}
        </div>
        {facts.length > 0 ? <p className={styles.editionFacts}>{facts.join(' · ')}</p> : <span />}
        {!preview ? <EditionLink edition={edition} primary={index === 0} /> : null}
      </li>
    })}</ul>
  </section>
}

export function ReleaseExternalEditions({ editions }: { editions: Edition[] }) {
  const external = editions.filter(edition => edition.status === 'published' && isExternalEditionUrl(edition.external_url))
  if (external.length === 0) return null
  return <section className={styles.external} aria-labelledby="release-external-title">
    <h2 id="release-external-title" className={styles.sectionSubtitle}>Выберите своё издание</h2>
    <ul>{external.map(edition => <li key={edition.id}>
      <Link href={edition.external_url!} target="_blank" rel="noopener noreferrer" data-metrika-goal="external_edition_open">
        {edition.platform || 'Открыть издание'}<ExternalLink size={16} aria-hidden="true" />
      </Link>
    </li>)}</ul>
  </section>
}
