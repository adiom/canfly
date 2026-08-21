'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ExternalLink, Search, Settings2, SlidersHorizontal } from 'lucide-react'
import type { EditionFormat, EditionStatus, EditionWithRelease } from '@/lib/releases-types'
import { EDITION_FORMAT_LABELS, QUALITY_TIER_LABELS } from '@/lib/utils/editions'
import { EDITION_FORMAT_ICONS, EDITION_STATUS_STAMPS } from '@/components/studio/edition-card'

const FORMAT_OPTIONS: Array<{ value: 'all' | EditionFormat; label: string }> = [
  { value: 'all', label: 'Все форматы' },
  ...(Object.entries(EDITION_FORMAT_LABELS) as Array<[EditionFormat, string]>).map(
    ([value, label]) => ({ value, label }),
  ),
]

const STATUS_OPTIONS: Array<{ value: 'all' | EditionStatus; label: string }> = [
  { value: 'all', label: 'Все статусы' },
  { value: 'draft', label: 'Черновики' },
  { value: 'published', label: 'Опубликованные' },
  { value: 'archived', label: 'Архив' },
]

const selectClass =
  'h-11 border border-cf-text-1/12 bg-cf-bg-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-2 outline-none transition-colors hover:border-cf-warm/45 focus:border-cf-warm/45'

/**
 * Сквозной список изданий: раньше добраться до издания можно было только через
 * страницу его релиза. Фильтры держим в состоянии клиента — выборка приходит
 * целиком с сервера и уже ограничена правами (см. getMyEditions).
 */
export function EditionsPageClient({
  editions,
  isAdmin,
}: {
  editions: EditionWithRelease[]
  isAdmin: boolean
}) {
  const [query, setQuery] = useState('')
  const [format, setFormat] = useState<'all' | EditionFormat>('all')
  const [status, setStatus] = useState<'all' | EditionStatus>('all')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return editions.filter((e) => {
      if (format !== 'all' && e.format !== format) return false
      if (status !== 'all' && e.status !== status) return false
      if (!needle) return true
      return (
        e.release_title.toLowerCase().includes(needle) ||
        e.slug.toLowerCase().includes(needle) ||
        (e.platform?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [editions, query, format, status])

  /** Группировка по релизу: порядок релизов — по самому свежему изданию. */
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; releaseId: string; items: EditionWithRelease[] }>()
    for (const edition of filtered) {
      const group = map.get(edition.release_id)
      if (group) {
        group.items.push(edition)
      } else {
        map.set(edition.release_id, {
          title: edition.release_title,
          releaseId: edition.release_id,
          items: [edition],
        })
      }
    }
    return [...map.values()]
  }, [filtered])

  const publishedCount = editions.filter((e) => e.status === 'published').length
  const chapterCount = editions.reduce((sum, e) => sum + e.chapter_count, 0)

  return (
    <div className="min-h-screen bg-cf-bg">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">

        <div className="mb-10 border-b border-cf-text-1/10 pb-8">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent">
            {isAdmin ? 'Все издания' : 'Мои издания'}
          </p>
          <h1 className="font-[family-name:var(--font-cormorant)] text-5xl font-bold italic leading-[0.9] text-cf-text-heading md:text-6xl">
            Издания
          </h1>
        </div>

        {editions.length > 0 && (
          <div className="mb-8 grid grid-cols-3 divide-x divide-cf-text-1/10 border border-cf-text-1/10">
            {[
              { value: editions.length, label: 'Изданий' },
              { value: publishedCount, label: 'Опубликовано' },
              { value: chapterCount, label: 'Глав' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center py-6">
                <span className="font-[family-name:var(--font-cormorant)] text-5xl font-bold leading-none text-cf-text-heading md:text-6xl">
                  {value}
                </span>
                <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {editions.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 border border-cf-text-1/12 bg-cf-bg-2 px-3">
              <Search className="h-4 w-4 flex-shrink-0 text-cf-text-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Релиз, слаг или платформа"
                className="w-full bg-transparent font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-2 outline-none placeholder:text-cf-text-4"
              />
            </label>

            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'all' | EditionFormat)}
              className={selectClass}
              aria-label="Формат"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | EditionStatus)}
              className={selectClass}
              aria-label="Статус"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {editions.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-cf-text-1/10 py-20">
            <span className="flex h-12 w-20 items-center justify-center bg-cf-accent text-sm font-black uppercase tracking-[-0.04em] text-white">
              canfly
            </span>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-cf-text-2">
              Пока нет изданий
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-3">
              Издание создаётся внутри релиза
            </p>
            <Link
              href="/studio"
              className="mt-6 inline-flex h-11 items-center gap-2 bg-cf-accent px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e]"
            >
              <BookOpen className="h-4 w-4" />
              К релизам
            </Link>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-cf-text-1/10 py-16">
            <SlidersHorizontal className="h-5 w-5 text-cf-text-3" />
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-3">
              Под фильтры ничего не подошло
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.releaseId}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <Link
                    href={`/studio/releases/${group.releaseId}`}
                    className="truncate text-sm font-black uppercase tracking-[0.06em] text-cf-text-heading transition-colors hover:text-cf-accent"
                  >
                    {group.title}
                  </Link>
                  <span className="flex-shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
                    {group.items.length} изд.
                  </span>
                </div>

                <div className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
                  {group.items.map((edition) => (
                    <EditionRow key={edition.id} edition={edition} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EditionRow({ edition }: { edition: EditionWithRelease }) {
  const Icon = EDITION_FORMAT_ICONS[edition.format] ?? BookOpen
  const status = EDITION_STATUS_STAMPS[edition.status] ?? EDITION_STATUS_STAMPS.draft
  const tier = QUALITY_TIER_LABELS[edition.quality_tier] ?? edition.quality_tier

  return (
    <div className="flex items-center gap-4 px-1 py-4">
      <Link
        href={`/studio/editions/${edition.id}`}
        className="group flex min-w-0 flex-1 items-center gap-4"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-cf-text-1/10 bg-cf-bg-2 transition-colors group-hover:border-cf-warm/45">
          <Icon className="h-4 w-4 text-cf-text-3 transition-colors group-hover:text-cf-accent" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase leading-none tracking-[0.04em] text-cf-text-heading transition-colors group-hover:text-cf-accent">
              {EDITION_FORMAT_LABELS[edition.format] ?? edition.format}
            </h3>
            {edition.format === 'book' && (
              <span className="border border-cf-text-1/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cf-text-3">
                {tier}
              </span>
            )}
            {edition.is_primary && (
              <span className="border border-cf-warm/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cf-warm">
                Основное
              </span>
            )}
          </div>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-cf-text-3">
            {[edition.slug, `${edition.chapter_count} глав`, edition.platform]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-2">
        <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${status.stamp}`}>
          {status.label}
        </span>
        <Link
          href={`/studio/editions/${edition.id}/setup`}
          title="Настройки издания"
          className="flex h-8 w-8 items-center justify-center border border-cf-text-1/12 text-cf-text-3 transition-colors hover:border-cf-warm/45 hover:text-cf-accent"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Link>
        {edition.status === 'published' && edition.format !== 'digital' && (
          <Link
            href={`/vvvvv/${edition.slug}`}
            title="Открыть читалку"
            className="flex h-8 w-8 items-center justify-center border border-cf-text-1/12 text-cf-text-3 transition-colors hover:border-cf-warm/45 hover:text-cf-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}
