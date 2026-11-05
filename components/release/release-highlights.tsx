import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import type { ChapterHighlight } from '@/lib/releases-types'
import { ReleaseDescription } from './release-description'
import styles from './release.module.css'

function HighlightItem({ highlight }: { highlight: ChapterHighlight }) {
  return <article className={styles.highlight}>
    {highlight.chapter_title ? <p className={styles.characterRole}>Фрагмент главы «{highlight.chapter_title}»</p> : null}
    <blockquote className={styles.quote}><ReleaseDescription text={highlight.text_content} limit={240} /></blockquote>
    <p className={styles.caption}>Карточку создал(а): {highlight.user_name || 'Читатель'}</p>
    {highlight.publication?.note ? <ReleaseDescription text={highlight.publication.note} /> : null}
    {highlight.publication && highlight.publication.materials.length > 0 ? <details className={styles.description}>
      <summary>Материалы работы · {highlight.publication.materials.length}</summary>
      {highlight.publication.materials.map(material => <div className={styles.material} key={material.id}>
        {material.kind === 'image' && material.image_url ?
          <Image src={material.image_url} alt={material.content || 'Иллюстрация по мотивам фрагмента'} width={480} height={480} unoptimized className={styles.materialImage} /> : null}
        {material.content ? <p>{material.content}</p> : null}
      </div>)}
    </details> : null}
    <div className={styles.characterActions}>
      <Link href={`/highlight/${highlight.id}`} className={styles.explorerLink}>Открыть работу<ArrowRight size={16} aria-hidden="true" /></Link>
      {highlight.edition_slug ? <Link href={`/vvvvv/${highlight.edition_slug}?highlight=${highlight.id}`} className={styles.textLink}>Исходный фрагмент</Link> : null}
    </div>
  </article>
}

export function ReleaseHighlights({ highlights }: { highlights: ChapterHighlight[] }) {
  return <section aria-labelledby="release-highlights-title">
    <h2 id="release-highlights-title" className={styles.sectionTitle}>Работы читателей</h2>
    {highlights.slice(0, 2).map(highlight => <HighlightItem key={highlight.id} highlight={highlight} />)}
    {highlights.length > 2 ? <details className={styles.more}><summary>Ещё работы · {highlights.length - 2}</summary>
      {highlights.slice(2).map(highlight => <HighlightItem key={highlight.id} highlight={highlight} />)}
    </details> : null}
  </section>
}
