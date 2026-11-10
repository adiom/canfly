import Image from 'next/image'
import Link from 'next/link'

import type { V2MediaRelease } from '@/lib/server/v2'
import { isAudioFormat } from '@/lib/utils/editions'
import styles from './v2.module.css'

/**
 * Сцена «одна медиасущность — несколько форм».
 *
 * Переключатель меняет только художественную подложку (осциллограмма или
 * строки текста) и подсвечивает релевантную строку формата. Никакого
 * воспроизведения здесь нет: каждая строка — ссылка на реально открытое
 * издание `/vvvvv/[slug]`, отобранное через `canOpenEdition` на сервере.
 */

export type MediaView = 'audio' | 'book'

export function initialMediaView(media: V2MediaRelease): MediaView {
  return media.editions.some((edition) => isAudioFormat(edition.format)) ? 'audio' : 'book'
}

const WAVE_BARS = Array.from({ length: 48 }, (_, i) => i)
const TEXT_LINES = Array.from({ length: 9 }, (_, i) => i)

interface MediaSceneViewProps {
  media: V2MediaRelease
  view?: MediaView
  onViewChange?: (view: MediaView) => void
}

export function MediaSceneView({ media, view = initialMediaView(media), onViewChange }: MediaSceneViewProps) {
  const hasAudio = media.editions.some((edition) => isAudioFormat(edition.format))
  const hasBook = media.editions.some((edition) =>
    edition.format === 'book' || edition.format === 'comic' || edition.format === 'magazine',
  )

  return (
    <div className={styles.mediaStage}>
      <div className={styles.mediaArt}>
        <div className={styles.mediaRings} aria-hidden="true" />
        {view === 'audio' ? (
          <svg
            className={`${styles.mediaVisual} ${styles.waveform}`}
            viewBox="0 0 480 160"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {WAVE_BARS.map((index) => {
              const height = 26 + ((index * 37) % 120)
              return (
                <rect
                  key={index}
                  className={styles.waveBar}
                  x={index * 10}
                  y={(160 - height) / 2}
                  width="4"
                  height={height}
                  rx="2"
                  fill="var(--v2-fg)"
                  fillOpacity={0.3 + ((index % 5) * 0.09)}
                  style={{ animationDelay: `${(index % 7) * 0.18}s` }}
                />
              )
            })}
          </svg>
        ) : (
          <div className={`${styles.mediaVisual} ${styles.textLines}`} aria-hidden="true">
            {TEXT_LINES.map((index) => (
              <span
                key={index}
                className={styles.textLine}
                style={{
                  width: `${58 + ((index * 29) % 40)}%`,
                  animationDelay: `${(index % 5) * 0.45}s`,
                }}
              />
            ))}
          </div>
        )}
        {media.cover ? (
          <Image
            className={styles.mediaCover}
            src={media.cover}
            alt={`Обложка релиза «${media.title}»`}
            width={720}
            height={720}
            sizes="(max-width: 950px) 54vw, 30vw"
          />
        ) : null}
      </div>

      <div className={styles.mediaContent}>
        <span className={styles.sectionTag}>Instinctus Insectorum</span>
        <h2 className={styles.mediaTitle}>{media.title}</h2>
        <p className={styles.mediaText}>{media.description}</p>

        {hasAudio && hasBook ? (
          <div className={styles.viewSwitch} role={onViewChange ? 'group' : undefined} aria-label={onViewChange ? 'Способ восприятия' : undefined}>
            {(['audio', 'book'] as const).map((option) => {
              const className = `${styles.viewSwitchButton} ${view === option ? styles.viewSwitchButtonActive : ''}`
              const label = option === 'audio' ? 'Аудио' : 'Книга'
              return onViewChange ? (
                <button key={option} type="button" className={className} aria-pressed={view === option} onClick={() => onViewChange(option)}>
                  {label}
                </button>
              ) : (
                <span key={option} className={className}>{label}</span>
              )
            })}
          </div>
        ) : null}

        <div className={styles.formatRows}>
          {media.editions.map((edition) => {
            const audio = isAudioFormat(edition.format)
            const highlighted =
              (view === 'audio' && audio) || (view === 'book' && !audio)
            return (
              <Link
                key={`${edition.format}:${edition.href}`}
                href={edition.href}
                className={`${styles.formatRow} ${highlighted ? styles.formatRowActive : ''}`}
              >
                <span>↗ &nbsp; {edition.label}</span>
                <span className={styles.formatRowAction}>{edition.action}</span>
              </Link>
            )
          })}
        </div>

        <Link href={media.href} className={styles.pill}>
          Единый релиз ↗
        </Link>
      </div>
    </div>
  )
}
