import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import type { ChapterHighlight } from '@/lib/releases-types'
import type { MaterialKind } from '@/lib/highlights/types'
import { pluralRu } from '@/lib/utils/format'
import styles from './release.module.css'

const MATERIAL_LABELS: Record<MaterialKind, string> = {
  text: 'Текст',
  explain: 'Пояснение',
  meaning: 'Толкование',
  rewrite: 'Переработка',
  image: 'Иллюстрация',
}

function HighlightCard({ highlight }: { highlight: ChapterHighlight }) {
  const materials = [...new Set(highlight.publication?.materials.map(material => MATERIAL_LABELS[material.kind]))]
  return (
    <article className="border-t border-cf-text-1/20 pt-4">
      <p className={styles.caption}>
        {[highlight.user_name || 'Читатель', ...materials].join(' · ')}
      </p>
      <blockquote className="mt-2 line-clamp-4 wrap-anywhere font-[family-name:var(--release-serif)] text-xl leading-snug">
        «{highlight.text_content}»
      </blockquote>
      {highlight.chapter_title ? <p className={`${styles.caption} mt-1`}>Глава «{highlight.chapter_title}»</p> : null}
      {highlight.publication?.note ? (
        <p className="mt-3 line-clamp-3 wrap-anywhere font-[family-name:var(--release-serif)] text-base">{highlight.publication.note}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-4">
        <Link href={`/highlight/${highlight.id}`} className={styles.textLink}>Открыть работу <ArrowRight size={16} aria-hidden="true" /></Link>
        {highlight.edition_slug ? (
          <Link href={`/vvvvv/${highlight.edition_slug}?highlight=${highlight.id}`} className={styles.textLink}>Исходный фрагмент</Link>
        ) : null}
      </div>
    </article>
  )
}

export function ReleaseHighlights({ highlights }: { highlights: ChapterHighlight[] }) {
  const more = highlights.length - 2

  return (
    <section aria-labelledby="release-highlights-title">
      <p className={styles.caption}>Сообщество Canfly</p>
      <h2 id="release-highlights-title" className={styles.sectionTitle}>Работы читателей</h2>
      <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {highlights.slice(0, 2).map(highlight => <HighlightCard key={highlight.id} highlight={highlight} />)}
      </div>
      {more > 0 ? (
        <details className="group mt-3">
          <summary className={`${styles.textLink} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            Ещё {more} {pluralRu(more, 'работа', 'работы', 'работ')}
            <ChevronDown size={16} aria-hidden="true" className="group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {highlights.slice(2).map(highlight => <HighlightCard key={highlight.id} highlight={highlight} />)}
          </div>
        </details>
      ) : null}
    </section>
  )
}
