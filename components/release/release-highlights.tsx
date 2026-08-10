'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
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
        <p className="mb-6 text-[10px] font-black uppercase tracking-[0.22em] text-cf-accent">
          цитаты читателей
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {visibleQuotes.map(highlight => (
            <Link
              key={highlight.id}
              href={`/highlight/${highlight.id}`}
              className="group block border-l-2 pl-5 transition-opacity hover:opacity-80"
              style={{ borderColor: accent }}
            >
              <p className="font-[family-name:var(--font-ebgaramond)] text-lg italic leading-snug text-cf-text-caption">
                «{highlight.text_content}»
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-cf-text-3">
                <span>{highlight.user_name ?? 'Читатель'}</span>
                {highlight.likes_count > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" style={{ color: accent }} />
                    {highlight.likes_count}
                  </span>
                )}
              </div>
            </Link>
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
              : `Ещё ${highlights.length - 2} ${pluralRu(highlights.length - 2, 'цитата', 'цитаты', 'цитат')}`}
          </button>
        )}
      </div>
    </section>
  )
}
