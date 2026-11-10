import Link from 'next/link'

import type { V2ExploreItem } from '@/lib/server/v2'
import { SceneReveal } from './scene-reveal'
import styles from './v2.module.css'

/**
 * Сцена 06 — продолжение exploration.
 *
 * Перечень названий собирается из опубликованных релизов БД, поэтому
 * список не разъезжается с каталогом; при пустом наборе остаётся только
 * честный CTA в каталог.
 */
interface ExploreSceneProps {
  items: V2ExploreItem[]
}

function joinTitles(items: V2ExploreItem[]): string {
  const titles = items.map((item) => `«${item.title}»`)
  if (titles.length === 0) return ''
  if (titles.length === 1) return titles[0]
  return `${titles.slice(0, -1).join(', ')} и ${titles[titles.length - 1]}`
}

export function ExploreScene({ items }: ExploreSceneProps) {
  const list = joinTitles(items)

  return (
    <section className={`${styles.shell} ${styles.newsline}`}>
      <SceneReveal>
        <span className={styles.eyebrow}>05 / More to explore</span>
        <h2 className={styles.newsTitle}>
          Каждая история —
          <br />
          новая дверь.
        </h2>
        <p className={styles.newsText}>
          {list ? `${list}${items.length > 1 ? ' и другие произведения' : ''} — ` : ''}
          каждый релиз открывает отдельный опыт: книгу, аудио, комикс или журнал.
        </p>
      </SceneReveal>

      <SceneReveal className={styles.actions}>
        <Link href="/releases" className={`${styles.pill} ${styles.pillPrimary}`}>
          Все релизы ↗
        </Link>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={styles.pill}>
            {item.title} ↗
          </Link>
        ))}
      </SceneReveal>
    </section>
  )
}
