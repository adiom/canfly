import Link from 'next/link'
import { ArrowRight, BookOpen, ExternalLink, Headphones, ImageIcon } from 'lucide-react'
import type { Edition } from '@/lib/releases-types'
import {
  EDITION_FORMAT_LABELS,
  getEditionAction,
  isAudioFormat,
  isDigitalFormat,
  isExternalEditionUrl,
  QUALITY_TIER_LABELS,
} from '@/lib/utils/editions'
import styles from './release.module.css'

export function EditionLink({ edition, primary = false, compact = false }: { edition: Edition; primary?: boolean; compact?: boolean }) {
  const external = isDigitalFormat(edition.format)
  if (external && !isExternalEditionUrl(edition.external_url)) return null

  const label = edition.format === 'comic'
    ? 'Читать комикс'
    : edition.format === 'book' || edition.format === 'magazine'
      ? primary ? 'Начать читать' : 'Читать в VVVVV'
      : getEditionAction(edition)
  const Icon = external ? ExternalLink : ArrowRight

  return (
    <Link
      href={external && edition.external_url ? edition.external_url : `/vvvvv/${edition.slug}`}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={compact ? styles.textLink : styles.action}
      data-primary={primary}
    >
      {label}
      <Icon size={compact ? 16 : 19} aria-hidden="true" />
    </Link>
  )
}

export function ReleaseEditions({ editions, preview }: { editions: Edition[]; preview: boolean }) {
  return (
    <section className={`release-container ${styles.container} ${styles.editions}`} id="release-editions" aria-labelledby="release-editions-title">
      <h2 className={styles.sectionTitle} id="release-editions-title">Издания</h2>
      <ul>
        {editions.map(edition => {
          const external = isDigitalFormat(edition.format)
          const Icon = external ? ExternalLink : isAudioFormat(edition.format) ? Headphones : edition.format === 'artwork' ? ImageIcon : BookOpen
          const status = edition.status === 'draft' ? 'Черновик' : 'Опубликовано'
          const platform = external ? edition.platform || 'Внешняя площадка' : 'Canfly'
          return (
            <li key={edition.id} className={styles.edition}>
              <Icon size={20} aria-hidden="true" />
              <div className="min-w-0">
                <p className={styles.editionTitle}>{EDITION_FORMAT_LABELS[edition.format]}</p>
                <p className={styles.caption}>
                  {[platform, edition.format === 'book' ? QUALITY_TIER_LABELS[edition.quality_tier] : null, preview ? status : 'Доступно'].filter(Boolean).join(' · ')}
                </p>
              </div>
              {!preview ? <EditionLink edition={edition} compact /> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
