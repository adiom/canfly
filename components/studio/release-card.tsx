'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Release, EditionFormat } from '@/lib/releases-types'
import { ExternalLink } from 'lucide-react'

type StudioRelease = Release & { formats: EditionFormat[]; edition_count: number }

const FORMAT_LABELS: Partial<Record<EditionFormat, string>> = {
  book: 'Книга',
  comic: 'Комикс',
  audiobook: 'Аудио',
  audiorelease: 'Аудио',
  magazine: 'Журнал',
  album: 'Альбом',
  digital: 'Цифровой',
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'text-cf-text-3 border-cf-text-1/20' },
  published: { label: 'Опубликован', className: 'text-cf-warm border-cf-warm/40' },
  archived: { label: 'Архив', className: 'text-cf-text-4 border-cf-text-1/15' },
}

function pluralEditions(n: number) {
  if (n === 0) return 'нет изданий'
  if (n === 1) return '1 издание'
  if (n >= 2 && n <= 4) return `${n} издания`
  return `${n} изданий`
}

export function ReleaseCard({ release }: { release: StudioRelease }) {
  const status = STATUS_CONFIG[release.status] ?? STATUS_CONFIG.draft
  const uniqueFormats = [...new Set(release.formats)]

  return (
    <div className="group flex items-center gap-4 py-4 px-1 transition-colors duration-200 hover:bg-cf-text-1/[0.03]">
      {/* Cover */}
      <Link href={`/studio/releases/${release.id}`} className="flex-shrink-0">
        <div className="relative h-16 w-11 overflow-hidden border border-cf-text-1/10 bg-cf-footer-bg transition-colors group-hover:border-cf-warm/40">
          {release.cover_image ? (
            <Image
              src={release.cover_image}
              alt={release.title}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-[7px] font-black uppercase tracking-[0.1em] text-cf-text-4">cf</span>
            </div>
          )}
        </div>
      </Link>

      {/* Main info */}
      <Link href={`/studio/releases/${release.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate text-sm font-black uppercase leading-none tracking-[0.04em] text-cf-text-heading transition-colors group-hover:text-cf-accent">
          {release.title}
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-cf-text-3">
          {[release.genre, pluralEditions(release.edition_count)]
            .filter(Boolean)
            .join(' · ')}
          {release.view_count > 0 && ` · ${release.view_count} просм.`}
        </p>
      </Link>

      {/* Formats + status */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {uniqueFormats.length > 0 && (
          <div className="hidden items-center gap-1 sm:flex">
            {uniqueFormats.map((fmt) => (
              <span
                key={fmt}
                className="border border-cf-text-1/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cf-text-3"
              >
                {FORMAT_LABELS[fmt] ?? fmt}
              </span>
            ))}
          </div>
        )}

        <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${status.className}`}>
          {status.label}
        </span>

        <Link
          href={`/release/${release.slug}`}
          target="_blank"
          className="flex h-7 w-7 items-center justify-center border border-cf-text-1/10 text-cf-text-3 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-1"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
