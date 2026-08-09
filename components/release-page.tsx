'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import {
  BookOpen, ArrowRight, Heart, Pen, ExternalLink, ChevronRight,
} from 'lucide-react'
import type {
  Release, Edition, ReleaseDesignConfig, Series, ChapterHighlight,
} from '@/lib/releases-types'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import {
  formatTotalDuration, getEditionLabel, isAudioFormat, isDigitalFormat,
} from '@/lib/utils/editions'
import { formatChapterCount, formatReadingTime, formatWordCount, pluralRu } from '@/lib/utils/format'

const defaultConfig: ReleaseDesignConfig = {
  accent_color: '#d52525',
  show_series: true,
}

const ROLE_LABELS: Record<string, string> = {
  main: 'Главный',
  supporting: 'Второстепенный',
  cameo: 'Камео',
}

interface ReleasePagePublicProps {
  release: Release
  editions: Edition[]
  primaryEditionSlug: string | null
  seriesLink: { series: Series; phase_number: number | null } | null
  highlights: ChapterHighlight[]
  meta: { chapterCount: number; wordCount: number; readingMinutes: number; durationSeconds: number }
  characters: Array<{ id: string; name: string; slug: string; avatar: string | null; role: string }>
  otherSeriesReleases: Array<{ id: string; title: string; slug: string; annotation: string | null; cover_image: string | null; release_date: string | null; phase_number: number | null }>
}

export function ReleasePagePublic({
  release, editions, primaryEditionSlug, seriesLink, highlights, meta, characters, otherSeriesReleases,
}: ReleasePagePublicProps) {
  const config = release.design_config ?? {}
  const accent = config.accent_color ?? defaultConfig.accent_color!

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

  const visibleQuotes = showAllQuotes ? highlights : highlights.slice(0, 2)

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/releases" />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-10 pb-12 md:px-8 md:pt-16 md:pb-20">
        <div className="grid items-start gap-8 md:grid-cols-[280px_1fr] md:gap-14 lg:grid-cols-[320px_1fr]">

          {/* Обложка */}
          <div className="mx-auto w-48 sm:w-56 md:mx-0 md:w-full">
            <div className="relative aspect-[2/3] overflow-hidden rounded-sm shadow-2xl ring-1 ring-cf-text-1/8">
              {release.cover_image ? (
                <Image
                  src={release.cover_image}
                  alt={release.title}
                  fill
                  sizes="(max-width: 768px) 192px, 320px"
                  className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-cf-bg-2">
                  <BookOpen className="h-12 w-12 text-cf-text-3 opacity-20" />
                </div>
              )}
            </div>
          </div>

          {/* Контент */}
          <div className="flex flex-col text-center md:text-left">

            {/* Жанр + серия */}
            <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-[0.22em] md:justify-start">
              {release.genre && (
                <span style={{ color: accent }}>{release.genre}</span>
              )}
              {config.show_series !== false && seriesLink && (
                <span className="flex items-center gap-1.5 text-cf-text-3">
                  <span className="opacity-30">·</span>
                  <Link
                    href={`/series/${seriesLink.series.slug}`}
                    className="transition-colors hover:text-cf-warm"
                  >
                    {seriesLink.series.title}
                    {seriesLink.phase_number ? ` · #${seriesLink.phase_number}` : ''}
                  </Link>
                </span>
              )}
            </div>

            {/* Заголовок */}
            <h1 className="font-[family-name:var(--font-cormorant)] text-6xl font-bold italic leading-[0.88] text-cf-text-heading sm:text-7xl md:text-8xl lg:text-[6.5rem]">
              {release.title}
            </h1>

            {/* Авторы */}
            {release.authors.length > 0 && (
              <p className="mt-4 text-base text-cf-text-2 md:text-lg">
                {release.authors.map(a => a.name).join(', ')}
              </p>
            )}

            {/* Мета */}
            {metaItems.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 text-xs text-cf-text-3 md:justify-start">
                {metaItems.map((item, i) => (
                  <span key={i} className="tabular-nums">
                    {i > 0 && <span className="mr-2 opacity-40">·</span>}
                    {item}
                  </span>
                ))}
              </div>
            )}

            {/* Studio button (admin only) */}
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

            {/* Аннотация — всегда видна */}
            {release.annotation && (
              <div className="mt-6 border-l-2 pl-5" style={{ borderColor: accent }}>
                <p className="font-[family-name:var(--font-ebgaramond)] text-xl italic leading-relaxed text-cf-text-caption md:text-2xl">
                  {release.annotation}
                </p>
              </div>
            )}

            {/* Кнопки изданий */}
            {published.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {published.map(edition => {
                  const isDigital = isDigitalFormat(edition.format)
                  const label = isDigital && edition.platform
                    ? edition.platform
                    : getEditionLabel(edition)
                  const href = isDigital && edition.external_url
                    ? edition.external_url
                    : `/vvvvv/${edition.slug}`
                  return (
                    <Link
                      key={edition.id}
                      href={href}
                      {...(isDigital ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="inline-flex items-center gap-2 rounded-full border border-cf-text-1/15 px-5 py-2.5 text-sm font-bold text-cf-text-1 transition-all hover:border-cf-text-1/30 hover:bg-cf-text-1/6 hover:shadow-md hover:shadow-cf-text-1/5"
                    >
                      {label}
                      {isDigital ? (
                        <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Персонажи ───────────────────────────────────────────────── */}
      {config.show_characters !== false && characters.length > 0 && (
        <section className="border-t border-cf-text-1/10">
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
            <p className="mb-6 text-[10px] font-black uppercase tracking-[0.22em] text-cf-accent">
              персонажи
            </p>
            <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {characters.map(char => (
                <Link
                  key={char.id}
                  href={`/characters/${char.slug}`}
                  className="group flex shrink-0 flex-col items-center gap-2 rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-all hover:border-cf-warm/45 hover:shadow-lg hover:shadow-cf-warm/5 md:w-[140px]"
                >
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-cf-text-1/8 ring-2 ring-cf-text-1/10 transition-all group-hover:ring-cf-warm/45">
                    {char.avatar ? (
                      <Image
                        src={char.avatar}
                        alt={char.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-cf-text-3">
                        {char.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-cf-text-heading group-hover:text-cf-warm transition-colors text-center leading-tight">
                    {char.name}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-cf-text-3">
                    {ROLE_LABELS[char.role] ?? char.role}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Серия ───────────────────────────────────────────────────── */}
      {config.show_series !== false && seriesLink && otherSeriesReleases.length > 0 && (
        <section className="border-t border-cf-text-1/10">
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cf-accent">
                серия
              </p>
              <Link
                href={`/series/${seriesLink.series.slug}`}
                className="mt-1 inline-flex items-center gap-1 text-lg font-bold text-cf-text-heading transition-colors hover:text-cf-warm"
              >
                {seriesLink.series.title}
                <ChevronRight className="h-4 w-4 opacity-40" />
              </Link>
              {seriesLink.series.description && (
                <p className="mt-2 max-w-2xl text-sm text-cf-text-caption">
                  {seriesLink.series.description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {otherSeriesReleases.map(r => {
                const isCurrent = r.id === release.id
                return (
                  <Link
                    key={r.id}
                    href={`/release/${r.slug}`}
                    className={`group flex items-start gap-4 rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-all hover:border-cf-warm/45 ${
                      isCurrent ? 'border-l-4 border-cf-accent opacity-60' : ''
                    }`}
                  >
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-cf-text-1/8">
                      {r.cover_image ? (
                        <Image
                          src={r.cover_image}
                          alt={r.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <BookOpen className="h-4 w-4 text-cf-text-3 opacity-30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        {r.phase_number !== null && (
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-cf-accent">
                            Том {r.phase_number}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-0.5 text-base font-bold text-cf-text-heading group-hover:text-cf-warm transition-colors truncate">
                        {r.title}
                      </h3>
                      {r.annotation && (
                        <p className="mt-1 line-clamp-1 text-xs text-cf-text-3">
                          {r.annotation}
                        </p>
                      )}
                    </div>
                    <div className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded border border-cf-text-1/10 bg-cf-bg text-cf-text-2 transition-colors group-hover:border-cf-accent group-hover:text-cf-accent">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── Цитаты ──────────────────────────────────────────────────── */}
      {highlights.length > 0 && (
        <section className="border-t border-cf-text-1/10">
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
            <p className="mb-6 text-[10px] font-black uppercase tracking-[0.22em] text-cf-accent">
              цитаты читателей
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {visibleQuotes.map(h => (
                <Link
                  key={h.id}
                  href={`/release/${release.slug}/highlight/${h.id}`}
                  className="group block border-l-2 pl-5 transition-opacity hover:opacity-80"
                  style={{ borderColor: accent }}
                >
                  <p className="font-[family-name:var(--font-ebgaramond)] text-lg italic leading-snug text-cf-text-caption">
                    «{h.text_content}»
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-cf-text-3">
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
            </div>
            {highlights.length > 2 && (
              <button
                type="button"
                onClick={() => setShowAllQuotes(v => !v)}
                className="mt-5 text-xs font-black uppercase tracking-[0.15em] opacity-60 transition-opacity hover:opacity-100"
                style={{ color: accent }}
              >
                {showAllQuotes ? 'Свернуть' : `Ещё ${highlights.length - 2} ${pluralRu(highlights.length - 2, 'цитата', 'цитаты', 'цитат')}`}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ─── Пустое состояние ────────────────────────────────────────── */}
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
