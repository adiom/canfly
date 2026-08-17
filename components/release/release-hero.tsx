import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react'
import type { Edition, Release, ReleaseDesignConfig, Series } from '@/lib/releases-types'
import { formatTotalDuration, getEditionLabel, isAudioFormat, isDigitalFormat } from '@/lib/utils/editions'
import { formatChapterCount, formatReadingTime, formatWordCount } from '@/lib/utils/format'
import { ReleaseStudioLink } from './release-studio-link'

const defaultConfig: ReleaseDesignConfig = { accent_color: '#d52525', show_series: true }

type ReleaseHeroProps = {
  release: Release
  editions: Edition[]
  primaryEditionSlug: string | null
  seriesLink: { series: Series; phase_number: number | null } | null
  meta: { chapterCount: number; wordCount: number; readingMinutes: number; durationSeconds: number }
}

export function ReleaseHero({ release, editions, primaryEditionSlug, seriesLink, meta }: ReleaseHeroProps) {
  const config = release.design_config ?? {}
  const accent = config.accent_color ?? defaultConfig.accent_color!
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

  return (
    <section className="mx-auto max-w-6xl px-5 pt-10 pb-12 md:px-8 md:pt-16 md:pb-20">
      <div className="grid items-start gap-8 md:grid-cols-[280px_1fr] md:gap-14 lg:grid-cols-[320px_1fr]">
        <div className="mx-auto w-48 sm:w-56 md:mx-0 md:w-full">
          <div className="relative aspect-[2/3] overflow-hidden rounded-sm shadow-2xl ring-1 ring-cf-text-1/8">
            {release.cover_image ? (
              <Image src={release.cover_image} alt={release.title} fill sizes="(max-width: 768px) 192px, 320px" className="object-cover transition-transform duration-500 hover:scale-[1.03]" priority />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-cf-bg-2"><BookOpen className="h-12 w-12 text-cf-text-3 opacity-20" /></div>
            )}
          </div>
        </div>

        <div className="flex flex-col text-center md:text-left">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-[0.22em] md:justify-start">
            {release.genre && <span style={{ color: accent }}>{release.genre}</span>}
            {config.show_series !== false && seriesLink && (
              <span className="flex items-center gap-1.5 text-cf-text-3">
                <span className="opacity-30">·</span>
                <Link href={`/series/${seriesLink.series.slug}`} className="transition-colors hover:text-cf-warm">
                  {seriesLink.series.title}{seriesLink.phase_number ? ` · #${seriesLink.phase_number}` : ''}
                </Link>
              </span>
            )}
          </div>

          <h1 className="font-[family-name:var(--font-cormorant)] text-6xl font-bold italic leading-[0.88] text-cf-text-heading sm:text-7xl md:text-8xl lg:text-[6.5rem]">{release.title}</h1>
          {release.authors.length > 0 && <p className="mt-4 text-base text-cf-text-2 md:text-lg">{release.authors.map(a => a.name).join(', ')}</p>}
          {metaItems.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 text-xs text-cf-text-3 md:justify-start">
              {metaItems.map((item, i) => <span key={item} className="tabular-nums">{i > 0 && <span className="mr-2 opacity-40">·</span>}{item}</span>)}
            </div>
          )}
          <ReleaseStudioLink releaseId={release.id} />
          {release.annotation && <div className="mt-6 border-l-2 pl-5" style={{ borderColor: accent }}><p className="font-[family-name:var(--font-ebgaramond)] text-xl italic leading-relaxed text-cf-text-caption md:text-2xl">{release.annotation}</p></div>}

          {published.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              {published.map(edition => {
                const isDigital = isDigitalFormat(edition.format)
                const label = isDigital && edition.platform ? edition.platform : getEditionLabel(edition)
                const href = isDigital && edition.external_url ? edition.external_url : `/vvvvv/${edition.slug}`
                return <Link key={edition.id} href={href} {...(isDigital ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="inline-flex items-center gap-2 rounded-full border border-cf-text-1/15 px-5 py-2.5 text-sm font-bold text-cf-text-1 transition-all hover:border-cf-text-1/30 hover:bg-cf-text-1/6 hover:shadow-md hover:shadow-cf-text-1/5">{label}{isDigital ? <ExternalLink className="h-3.5 w-3.5 opacity-50" /> : <ArrowRight className="h-3.5 w-3.5" />}</Link>
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
