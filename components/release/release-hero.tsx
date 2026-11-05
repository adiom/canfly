import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react'
import type { Edition, Release, ReleaseDesignConfig, Series } from '@/lib/releases-types'
import { formatTotalDuration, getEditionAction, getEditionLabel, isAudioFormat, isDigitalFormat, isExternalEditionUrl } from '@/lib/utils/editions'
import { formatChapterCount, formatReadingTime, formatWordCount } from '@/lib/utils/format'
import { ReleaseStudioLink } from './release-studio-link'

const defaultConfig: ReleaseDesignConfig = { accent_color: '#d52525', show_series: true }

type ReleaseHeroProps = {
  release: Release
  editions: Edition[]
  primaryEditionSlug: string | null
  seriesLink: { series: Series; phase_number: number | null } | null
  meta: { chapterCount: number; wordCount: number; readingMinutes: number; durationSeconds: number }
  preview?: boolean
}

export function ReleaseHero({ release, editions, primaryEditionSlug, seriesLink, meta, preview }: ReleaseHeroProps) {
  const config = release.design_config ?? {}
  const annotation = release.annotation || release.description
  const accent = config.accent_color ?? defaultConfig.accent_color!
  const published = editions.filter(e => e.status === 'published')
  const primaryEdition = published.find(e => e.slug === primaryEditionSlug) ?? null
  const sortedEditions = primaryEdition ? [primaryEdition, ...published.filter(e => e.id !== primaryEdition.id)] : published
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
      <div className={config.hero_style === 'centered'
        ? 'mx-auto grid max-w-3xl items-start gap-8 [&>div]:mx-auto [&>div]:text-center'
        : 'grid items-start gap-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-14 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]'}>
        <div className="mx-auto w-48 sm:w-56 md:mx-0 md:w-full">
          <div className="relative aspect-[2/3] overflow-hidden rounded-sm shadow-2xl ring-1 ring-cf-text-1/8">
            {release.cover_image ? (
              <Image src={release.cover_image} alt={release.title} fill sizes="(max-width: 768px) 192px, 320px" className={config.cover_fit === 'contain' ? 'object-contain' : 'object-cover'} priority />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-cf-bg-2"><BookOpen className="h-12 w-12 text-cf-text-3 opacity-20" /></div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col text-center md:text-left">
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

          <h1 className="font-[family-name:var(--font-cormorant)] text-[clamp(2.25rem,10vw,3.75rem)] font-bold italic leading-[0.88] text-cf-text-heading [overflow-wrap:anywhere] sm:text-7xl md:text-8xl lg:text-[6.5rem]">{release.title}</h1>
          {release.authors.length > 0 && <p className="mt-4 text-base text-cf-text-2 md:text-lg">{release.authors.map(a => a.name).join(', ')}</p>}
          {metaItems.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 text-xs text-cf-text-3 md:justify-start">
              {metaItems.map((item, i) => <span key={item} className="tabular-nums">{i > 0 && <span className="mr-2 opacity-40">·</span>}{item}</span>)}
            </div>
          )}
          <ReleaseStudioLink releaseId={release.id} />
          {annotation && <div className="mt-6 border-l-2 pl-5" style={{ borderColor: accent }}><p className="font-[family-name:var(--font-ebgaramond)] text-xl italic leading-relaxed text-cf-text-caption md:text-2xl">{annotation}</p></div>}

          {preview && editions.length > 0 && (
            <ul aria-label="Издания в предпросмотре" className="mt-6 flex flex-wrap gap-3 text-sm">
              {editions.map(edition => <li key={edition.id}>{getEditionLabel(edition)} · {edition.status === 'draft' ? 'черновик' : 'опубликовано'}</li>)}
            </ul>
          )}
          {!preview && published.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              {sortedEditions.map(edition => {
                const isDigital = isDigitalFormat(edition.format)
                const primary = edition.id === primaryEdition?.id
                if (isDigital && !isExternalEditionUrl(edition.external_url)) return null
                const href = isDigital && edition.external_url ? edition.external_url : `/vvvvv/${edition.slug}`
                return <Link key={edition.id} href={href} {...(isDigital ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-cf-text-1/15 px-5 py-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 ${primary ? 'bg-cf-text-1 text-cf-bg' : 'text-cf-text-1 hover:bg-cf-text-1/6'}`}>{primary ? getEditionAction(edition) : getEditionLabel(edition)}{isDigital ? <ExternalLink aria-hidden="true" className="size-3.5" /> : <ArrowRight aria-hidden="true" className="size-3.5" />}</Link>
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
