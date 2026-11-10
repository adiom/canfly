import styles from './v2.module.css'

/**
 * Подвал художественной главной: крупный знак и служебная строка.
 * Навигационных ссылок на разделы здесь нет — шапка страницы отдельная.
 */
export function V2Footer() {
  return (
    <footer className={styles.foot}>
      <div className={styles.footBig} aria-hidden="true">
        canfly.
      </div>
      <div className={styles.footBottom}>
        <span>THE MEDIA DIMENSION FOR INTERACTIVE INTERACTIONS</span>
        <span>ART HOME STUDY / 2026 — NOINDEX</span>
        <a href="#top">НАВЕРХ ↑</a>
      </div>
    </footer>
  )
}
