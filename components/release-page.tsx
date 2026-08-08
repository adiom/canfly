'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import {
  BookOpen, ArrowRight, Heart, Pen,
} from 'lucide-react'
import type {
  Release, Edition, ReleaseDesignConfig, Series, ChapterHighlight,
} from '@/lib/releases-types'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import {
  formatTotalDuration, getEditionLabel, getEditionTocUrl, isAudioFormat,
} from '@/lib/utils/editions'
import { formatChapterCount, formatReadingTime, formatWordCount, pluralRu } from '@/lib/utils/format'

const defaultConfig: ReleaseDesignConfig = {
  accent_color: '#d52525',
  show_series: true,
}

interface ReleasePagePublicProps {
  release: Release
  editions: Edition[]
  primaryEditionSlug: string | null
  primaryEditionTier: string | null
  characters: { id: string; name: string; slug: string; avatar: string | null; role: string }[]
  seriesLink: { series: Series; phase_number: number | null } | null
  highlights: ChapterHighlight[]
  meta: { chapterCount: number; wordCount: number; readingMinutes: number; durationSeconds: number }
}

export function ReleasePagePublic({
  release, editions, primaryEditionSlug, primaryEditionTier, characters, seriesLink, highlights, meta,
}: ReleasePagePublicProps) {
  const config = release.design_config ?? {}
  const accent = config.accent_color ?? defaultConfig.accent_color!
  const showSeries = config.show_series ?? defaultConfig.show_series!

  const { data: session } = useSession()
  const roles: string[] = session?.user?.roles ?? []
  const isAdmin = roles.includes('admin')

  const [showAllQuotes, setShowAllQuotes] = useState(false)

  const published = editions.filter(e => e.status === 'published')

  const primaryEdition = published.find(e => e.slug === primaryEditionSlug) ?? null
  const primaryIsAudio = primaryEdition ? isAudioFormat(primaryEdition.format) : false

  const metaItems: string[] = []
  if (meta.chapterCount > 0) metaItems.push(formatChapterCount(meta.chapterCount, primaryIsAudio))
  if (primaryIsAudio) {
    if (meta.durationSeconds > 0) metaItems.push(formatTotalDuration(meta.durationSeconds))
  } else {
    if (meta.wordCount > 0) metaItems.push(formatWordCount(meta.wordCount))
    if (meta.readingMinutes > 0) metaItems.push(formatReadingTime(meta.readingMinutes))
  }

  const visibleQuotes = showAllQuotes ? highlights : highlights.slice(0, 1)

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/releases" />

      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-[320px_1fr] md:gap-14">
          {/* Обложка */}
          <div className="mx-auto w-44 sm:w-56 md:mx-0 md:w-full">
            <div className="relative aspect-[2/3] overflow-hidden rounded-sm shadow-2xl">
              {release.cover_image ? (
                <Image src={release.cover_image} alt={release.title} fill sizes="(max-width: 768px) 176px, 320px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-cf-bg-2">
                  <BookOpen className="h-10 w-10 text-cf-text-3 opacity-30" />
                </div>
              )}
            </div>
          </div>

          {/* Контент */}
          <div className="flex flex-col text-center md:text-left">
            {/* Жанр */}
            <div className="mb-4 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>
              {release.genre}
              {showSeries && seriesLink && (
                <>
                  {release.genre && <span className="opacity-30"> ·-+ </span>}
                  СЕРИЯ: 
                  <Link
                    href={`/series/${seriesLink.series.slug}`}
                    className="hover:text-cf-warm transition-colors"
                  >
                    <span className="opacity-60">
                      
                      {seriesLink.series.title}
                      {seriesLink.phase_number ? ` · #${seriesLink.phase_number}` : ''}
                    </span>
                  </Link>
                </>
              )}
            </div>

            {/* Заголовок */}
            <h1 className="font-[family-name:var(--font-cormorant)] text-5xl font-bold italic leading-[0.9] text-cf-text-heading md:text-7xl">
              {release.title}
            </h1>

            {/* Авторы */}
            {release.authors.length > 0 && (
              <p className="mt-4 text-sm text-cf-text-2">
                {release.authors.map(a => a.name).join(', ')}
              </p>
            )}

            {/* Мета */}
            {metaItems.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-1 text-xs text-cf-text-3 md:justify-start">
                {metaItems.map((item, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mr-1 opacity-40">·</span>}
                    {item}
                  </span>
                ))}
              </div>
            )}

            {/* Кнопка редактирования в Studio (только для админов) */}
            {isAdmin && (
              <div className="mt-4">
                <Link
                  href={`/studio/releases/${release.id}`}
                  className="inline-flex items-center gap-1.5 rounded border border-cf-text-1/15 bg-cf-text-1/6 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 transition-colors hover:border-cf-accent hover:bg-cf-accent/10 hover:text-cf-accent"
                >
                  <Pen className="h-3 w-3" />
                  Studio
                </Link>
              </div>
            )}

            {/* Аннотация */}
            {release.annotation && (
              <p className="mt-6 font-[family-name:var(--font-cormorant)] text-lg italic leading-relaxed text-cf-text-caption md:text-xl">
                {release.description}
              </p>
            )}

            {/* Pills-кнопки изданий */}
            {published.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {published.map(edition => {
                  const label = getEditionLabel(edition)
                  return (
                    <Link
                      key={edition.id}
                      href={getEditionTocUrl(release.slug, edition)}
                      className="inline-flex items-center gap-2 rounded-full border border-cf-text-1/15 px-5 py-2.5 text-sm font-bold text-cf-text-1 transition-colors hover:bg-cf-text-1/8"
                    >
                      {label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Цитата (pull-quote) */}
            {visibleQuotes.length > 0 && (
              <div className="mt-10 border-l-2 pl-4" style={{ borderColor: accent }}>
                {visibleQuotes.map(h => (
                  <Link
                    key={h.id}
                    href={`/release/${release.slug}/highlight/${h.id}`}
                    className="group block"
                  >
                    <p className="font-[family-name:var(--font-cormorant)] text-lg italic leading-snug text-cf-text-caption">
                      «{h.text_content}»
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-cf-text-3">
                      <span>{h.user_name ?? 'Читатель'}</span>
                      {h.likes_count > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3" style={{ color: accent }} />
                          {h.likes_count}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
                {highlights.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAllQuotes(v => !v)}
                    className="mt-3 text-xs font-black uppercase tracking-[0.15em] opacity-60 transition-opacity hover:opacity-100"
                    style={{ color: accent }}
                  >
                    {showAllQuotes ? 'Свернуть' : `Ещё ${highlights.length - 1} ${pluralRu(highlights.length - 1, 'цитата', 'цитаты', 'цитат')}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {!published.length && (
        <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
          <div className="border-t border-cf-text-1/10 py-16 text-center text-cf-text-3">
            Издания пока не опубликованы
          </div>
        </div>
      )}

      <SiteFooter variant="simple" />
    </div>
  )
}
