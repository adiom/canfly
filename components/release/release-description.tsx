import styles from './release.module.css'

/** One copy of the source text, including the disclosure, in server HTML. */
export function ReleaseDescription({ text, limit = 180 }: { text: string; limit?: number }) {
  const end = text.length > limit ? text.lastIndexOf(' ', limit) : text.length
  const intro = text.slice(0, end > 0 ? end : limit)
  const rest = text.slice(intro.length).trim()
  return <div className={styles.characterBio}><p>{intro}</p>
    {rest ? <details className={styles.description}><summary>Подробнее</summary><p>{rest}</p></details> : null}
  </div>
}
