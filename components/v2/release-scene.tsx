import Image from 'next/image'
import Link from 'next/link'

import type { V2FeaturedRelease } from '@/lib/server/v2'
import { SceneReveal } from './scene-reveal'
import styles from './v2.module.css'

/**
 * Сцена 02 — выбранный релиз.
 *
 * Название, обложка, описание, форматы и серия приходят из БД; если релиза
 * нет среди опубликованных, сцена просто не рендерится — CTA на несуществующий
 * контент не появляется.
 */
export function ReleaseScene({ release }: { release: V2FeaturedRelease }) {
  const [firstWord, ...restWords] = release.title.split(' ')
  const tail = restWords.join(' ')

  return (
    <section className={`${styles.shell} ${styles.feature}`} id="releases">
      <div className={styles.sectionHead}>
        <small className={styles.sectionHeadSmall}>01 / Selected release</small>
        <Link href="/releases" className={styles.sectionHeadLink}>
          Все релизы ↗
        </Link>
      </div>

      <div className={styles.featureGrid}>
        <SceneReveal className={styles.featureCopy}>
          <p className={styles.sectionTag}>
            {release.genre ?? 'Фантастика / Форма / Человек'}
          </p>
          <h2 className={styles.featureTitle}>
            {firstWord}
            {tail ? (
              <>
                <br />
                <i className={styles.featureTitleI}>{tail}</i>
              </>
            ) : null}
          </h2>
          {release.description ? (
            <p className={styles.featureText}>{release.description}</p>
          ) : null}

          <div className={styles.submeta}>
            {release.formats.map((format) => (
              <span key={format} className={styles.chip}>
                {format}
              </span>
            ))}
            {release.series ? (
              <Link href={release.series.href} className={styles.chip}>
                серия из {release.series.releaseCount} релизов
              </Link>
            ) : null}
          </div>

          <Link href={release.href} className={`${styles.pill} ${styles.pillPrimary}`}>
            Исследовать релиз ↗
          </Link>
        </SceneReveal>

        <SceneReveal className={styles.artframe}>
          <div className={styles.orbitRing} aria-hidden="true" />
          <div className={`${styles.orbitRing} ${styles.orbitRingSecond}`} aria-hidden="true" />
          {release.cover ? (
            <div className={styles.artWrap}>
              <Image
                className={styles.artImage}
                src={release.cover}
                alt={`Обложка релиза «${release.title}»`}
                width={800}
                height={1200}
                sizes="(max-width: 600px) 62vw, 360px"
              />
            </div>
          ) : (
            <div className={styles.artFallback}>{release.title}</div>
          )}
          <span className={styles.frameCorner}>CANFLY / RELEASE 001</span>
          <span className={styles.frameBottom}>A STORY IS NEVER FLAT ↗</span>
        </SceneReveal>
      </div>
    </section>
  )
}
