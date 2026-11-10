import Link from 'next/link'

import type { V2MediaRelease } from '@/lib/server/v2'
import { MultimediaSceneLoader } from './lazy-scenes'
import { MediaSceneView } from './media-scene-view'
import { SceneReveal } from './scene-reveal'
import styles from './v2.module.css'

/**
 * Сцена 05 — одна медиасущность, несколько способов восприятия.
 *
 * Ссылки на издания формирует сервер через `canOpenEdition`: сцена
 * показывается только если хотя бы одно издание реально открывается.
 * Фальшивого воспроизведения музыки нет — это художественная подложка,
 * а не плеер.
 */
interface MediaSceneProps {
  media: V2MediaRelease | null
}

export function MediaScene({ media }: MediaSceneProps) {
  if (!media) return null

  return (
    <section className={`${styles.shell} ${styles.media}`} id="media">
      <div className={styles.sectionHead}>
        <small className={styles.sectionHeadSmall}>04 / Multiple forms / one release</small>
        <Link href={media.href} className={styles.sectionHeadLink}>
          Открыть релиз ↗
        </Link>
      </div>

      <SceneReveal>
        <MultimediaSceneLoader media={media} fallback={<MediaSceneView media={media} />} />
      </SceneReveal>
    </section>
  )
}
