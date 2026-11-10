import { SceneReveal } from './scene-reveal'
import styles from './v2.module.css'

/**
 * Тезис между героем и сценами: форматы и истории пересекаются.
 * Без данных — чистая типографика, поэтому отдельный серверный блок.
 */
export function StatementSection() {
  return (
    <section className={`${styles.shell} ${styles.statement}`}>
      <SceneReveal>
        <p className={styles.eyebrow}>00 / The proposition</p>
        <h2 className={styles.bigStatement}>
          Одно произведение —{' '}
          <span className={styles.bigStatementDim}>не один формат.</span> Один
          персонаж —{' '}
          <em className={styles.bigStatementEm}>не одна история.</em> И всё это
          может быть связано.
        </h2>
      </SceneReveal>
    </section>
  )
}
