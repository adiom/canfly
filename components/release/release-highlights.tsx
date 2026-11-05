'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ChapterHighlight } from '@/lib/releases-types'
import { pluralRu } from '@/lib/utils/format'

export function ReleaseHighlights({
  highlights,
  accent,
}: {
  highlights: ChapterHighlight[]
  accent: string
}) {
  const [showAllQuotes, setShowAllQuotes] = useState(false)

  if (highlights.length === 0) return null

  const visibleQuotes = showAllQuotes ? highlights : highlights.slice(0, 2)

  return (
    <section className="border-t border-cf-text-1/10">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h3 className="text-2xl font-semibold tracking-tight text-cf-text-heading md:text-3xl">Работы читателей</h3>
        <p className="mb-6 mt-2 text-sm text-cf-text-2">Интерпретации аудитории с указанием автора и исходного фрагмента.</p>
        <div className="grid gap-6 md:grid-cols-2">
          {visibleQuotes.map(highlight => (
            <article
              key={highlight.id}
              className="rounded-r-xl border-l-2 bg-cf-bg-2 p-5"
              style={{ borderColor: accent }}
            >
              <p className="mb-2 text-sm font-semibold">{highlight.user_name ?? 'Читатель'}</p>
              {highlight.chapter_title && <p className="mb-2 text-xs text-cf-text-3">Глава «{highlight.chapter_title}»</p>}
              <blockquote className="line-clamp-4 text-base leading-relaxed text-cf-text-caption">
                «{highlight.text_content}»
              </blockquote>
              {highlight.publication?.note && <p className="mt-3 line-clamp-3 text-sm">{highlight.publication.note}</p>}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link href={`/highlight/${highlight.id}`} className="font-semibold underline underline-offset-4">Открыть работу</Link>
                {highlight.edition_slug && <Link href={`/vvvvv/${highlight.edition_slug}?highlight=${highlight.id}`} className="underline underline-offset-4">Исходный фрагмент</Link>}
              </div>
            </article>
          ))}
        </div>
        {highlights.length > 2 && (
          <button
            type="button"
            onClick={() => setShowAllQuotes(value => !value)}
            className="mt-5 text-xs font-black uppercase tracking-[0.15em] opacity-60 transition-opacity hover:opacity-100"
            style={{ color: accent }}
          >
            {showAllQuotes
              ? 'Свернуть'
              : `Ещё ${highlights.length - 2} ${pluralRu(highlights.length - 2, 'работа', 'работы', 'работ')}`}
          </button>
        )}
      </div>
    </section>
  )
}
