'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ChapterHighlight } from '@/lib/releases-types'
import styles from './release.module.css'

type WorldItem = {
  id: string
  title: string
  relation: string
  description: string
  href: string
  action: string
}

export function ReleaseWorldExplorer({ title, highlights }: {
  title: string
  highlights: ChapterHighlight[]
}) {
  const items: WorldItem[] = [
    ...highlights.map(highlight => ({
      id: `highlight-${highlight.id}`,
      title: highlight.chapter_title || 'Выделенный фрагмент',
      relation: `Работа читателя · ${highlight.user_name || 'Читатель'}`,
      description: highlight.publication?.note || highlight.text_content,
      href: `/highlight/${highlight.id}`,
      action: 'Открыть работу',
    })),
  ]
  const [selectedId, setSelectedId] = useState(items[0]?.id)
  const selected = items.find(item => item.id === selectedId) ?? items[0]
  if (!selected) return null

  return (
    <section className={styles.explorer} aria-label="Связи произведения">
      <div className={styles.explorerChoices}>
        <div className={styles.explorerHub}><small>Произведение</small>{title}</div>
        <div className={styles.explorerList} role="group" aria-label="Связанные объекты">
          {items.map(item => (
            <button key={item.id} type="button" className={styles.explorerChoice} aria-pressed={item.id === selected.id} onClick={() => setSelectedId(item.id)}>
              <span><strong>{item.title}</strong><small>{item.relation}</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div className={styles.explorerDetail} aria-live="polite">
        <p>{selected.relation}</p>
        <h2>{selected.title}</h2>
        <p>{selected.description}</p>
        <Link href={selected.href} className={styles.explorerLink}>{selected.action} <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  )
}
