import { MediaDimensionGeometry } from './media-dimension-geometry'
import styles from './v2.module.css'

/**
 * Сцена 01 — The Media Dimension.
 *
 * H1 страницы живёт здесь ровно один раз; подзаголовки остальных сцен — H2.
 * Декоративная пыль рендерится на уровне страницы (см. `app/v2/page.tsx`):
 * она лежит под контентом и не привязана к первому экрану.
 */
export function ArtHero({ hasFeatured, hasGraph, hasFeed = false }: { hasFeatured: boolean; hasGraph: boolean; hasFeed?: boolean }) {
  return (
    <section className={styles.hero} id="top">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroArt} aria-hidden="true">
        <MediaDimensionGeometry />
      </div>

      <div className={`${styles.shell} ${styles.heroContent}`}>
        <p className={`${styles.eyebrow} ${styles.heroOverline}`}>
          Canfly / Dimension 001 — Interactive media universe
        </p>
        <h1 className={styles.heroTitle}>
          Истории
          <br />
          существуют <i className={styles.heroTitleI}>за пределами</i>
          <br />
          страниц<span className={styles.heroTitleDot}>.</span>
        </h1>
        <div className={styles.heroDesc}>
          <p className={styles.heroText}>
            Книги, персонажи, музыка и миры, которые связаны между собой. Не просто
            читать. Исследовать.
          </p>
          <div className={styles.actions}>
            <a href={hasFeed ? '#journal' : hasFeatured ? '#releases' : '/releases'} className={`${styles.pill} ${styles.pillPrimary}`}>
              {hasFeed ? 'Читать ленту' : 'Войти в пространство'} <span aria-hidden>↘</span>
            </a>
            <a href={hasGraph ? '#connections' : '/characters'} className={styles.pill}>
              {hasGraph ? 'Увидеть связи ↗' : 'Встретить персонажей ↗'}
            </a>
          </div>
        </div>
      </div>

      <p className={styles.scrollCue}>SCROLL TO ENTER THE DIMENSION</p>
      <p className={styles.sideWord} aria-hidden="true">
        CANFLY / NOT A CATALOG
      </p>
    </section>
  )
}
