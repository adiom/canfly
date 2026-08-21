"use client"

import Link from 'next/link'
import type { Edition } from '@/lib/releases-types'
import { EDITION_FORMAT_LABELS, QUALITY_TIER_LABELS } from '@/lib/utils/editions'
import { BookOpen, Globe, Headphones, Image, Music, Newspaper, Radio } from 'lucide-react'

/** Иконки форматов — общие с разделом /studio/editions. */
export const EDITION_FORMAT_ICONS: Record<string, React.ElementType> = {
  book: BookOpen,
  comic: Image,
  audiobook: Headphones,
  audiorelease: Radio,
  album: Music,
  magazine: Newspaper,
  digital: Globe,
}

export const EDITION_STATUS_STAMPS = {
  draft: { label: 'Черновик', stamp: 'border-cf-text-1/20 text-cf-text-3' },
  published: { label: 'Опубликован', stamp: 'border-cf-warm/40 text-cf-warm' },
  archived: { label: 'Архив', stamp: 'border-cf-text-1/15 text-cf-text-4' },
} as const

export function EditionCard({ edition }: { edition: Edition }) {
  const Icon = EDITION_FORMAT_ICONS[edition.format] ?? BookOpen
  const status = EDITION_STATUS_STAMPS[edition.status] ?? EDITION_STATUS_STAMPS.draft
  const tier = edition.quality_tier
    ? QUALITY_TIER_LABELS[edition.quality_tier] ?? edition.quality_tier
    : null

  return (
    <Link
      href={`/studio/editions/${edition.id}`}
      className="group flex items-center gap-4 px-1 py-4 transition-colors hover:bg-cf-text-1/[0.03]"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-cf-text-1/10 bg-cf-bg-2 transition-colors group-hover:border-cf-warm/45">
        <Icon className="h-4 w-4 text-cf-text-3 transition-colors group-hover:text-cf-accent" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black uppercase leading-none tracking-[0.04em] text-cf-text-heading transition-colors group-hover:text-cf-accent">
            {EDITION_FORMAT_LABELS[edition.format] ?? edition.format}
          </h3>
          {tier && (
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
          {[edition.platform, edition.slug, edition.id.slice(0, 8)].filter(Boolean).join(' · ')}
        </p>
      </div>

      <span className={`flex-shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${status.stamp}`}>
        {status.label}
      </span>
    </Link>
  )
}
