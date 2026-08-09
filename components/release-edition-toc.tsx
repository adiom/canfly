import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, BookOpen, Heart, Pen, Play, ScrollText } from 'lucide-react'
import type { Chapter, ChapterHighlight, Edition, Release } from '@/lib/releases-types'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import {
  type EditionMeta,
  formatDuration,
  formatTotalDuration,
  getChapterUrl,
  getEditionFullUrl,
  getEditionLabel,
  getEditionTocUrl,
  isAudioFormat,
} from '@/lib/utils/editions'
import { formatChapterCount, formatReadingTime, formatWordCount } from '@/lib/utils/format'
import { CATALOG_PATH } from '@/lib/nav'

const DEFAULT_ACCENT = '#d52525'

export interface EditionResume {
  chapterNumber: number
  chapterTitle: string
  percent: number
}

interface ReleaseEditionTocProps {
  release: Release
  edition: Edition
  chapters: Omit<Chapter, 'content'>[]
  otherEditions: Edition[]
  highlights: ChapterHighlight[]
  meta: EditionMeta
  resume: EditionResume | null
  progressByChapter: Record<string, number>
  isAdmin: boolean
}

export function ReleaseEditionToc({
  release,
  edition,
  chapters,
  otherEditions,
  highlights,
  meta,
  resume,
  progressByChapter,
  isAdmin,
}: ReleaseEditionTocProps) {
  const accent = release.design_config?.accent_color ?? DEFAULT_ACCENT
  const isAudio = isAudioFormat(edition.format)
  const firstChapterUrl = getChapterUrl(release.slug, edition, 1)

  const metaItems: string[] = []
  if (meta.chapterCount > 0) metaItems.push(formatChapterCount(meta.chapterCount, isAudio))
  if (isAudio) {
    if (meta.durationSeconds > 0) metaItems.push(formatTotalDuration(meta.durationSeconds))
  } else {
    if (meta.wordCount > 0) metaItems.push(formatWordCount(meta.wordCount))
    if (meta.readingMinutes > 0) metaItems.push(formatReadingTime(meta.readingMinutes))
  }

  const fullerEdition = otherEditions.find(e => e.quality_tier === 'standard')
    ?? otherEditions.find(e => e.quality_tier === 'premium')
    ?? null
  const showDraftNotice = edition.quality_tier === 'draft' && fullerEdition !== null

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath={CATALOG_PATH} />

      <section className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <Link
          href={`/release/${release.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-cf-text-3 transition-colors hover:text-cf-text-1"
        >
          <ArrowLeft className="h-3 w-3" />
          {release.title}
        </Link>

        <div className="mt-8 grid gap-10 md:grid-cols-[260px_1fr] md:gap-14">
          <div className="mx-auto w-40 sm:w-52 md:mx-0 md:w-full">
            <div className="relative aspect-[2/3] overflow-hidden rounded-sm shadow-2xl">
              {release.cover_image ? (
                <Image
                  src={release.cover_image}
                  alt={release.title}
                  fill
                  sizes="(max-width: 768px) 160px, 260px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-cf-bg-2">
                  <BookOpen className="h-10 w-10 text-cf-text-3 opacity-30" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <p
              className="text-[10px] font-black uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              {getEditionLabel(edition)}
            </p>

            <h1 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl font-bold italic leading-[0.95] text-cf-text-heading md:text-6xl">
              {release.title}
            </h1>

            {release.authors.length > 0 && (
              <p className="mt-3 text-sm text-cf-text-2">
                {release.authors.map(a => a.name).join(', ')}
              </p>
            )}

            {metaItems.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-1 text-xs text-cf-text-3">
                {metaItems.map((item, i) => (
                  <span key={item}>
                    {i > 0 && <span className="mr-1 opacity-40">·</span>}
                    {item}
                  </span>
                ))}
              </div>
            )}

            {showDraftNotice && fullerEdition && (
              <div className="mt-6 border border-cf-accent/30 bg-cf-accent/10 px-4 py-3 text-sm text-cf-accent">
                Это черновая версия — текст ещё меняется.{' '}
                <Link
                  href={getEditionTocUrl(release.slug, fullerEdition)}
                  className="font-bold underline underline-offset-2"
                >
                  Открыть «{getEditionLabel(fullerEdition)}»
                </Link>
              </div>
            )}
            {release.annotation && (
              <p className="mt-6 text-sm text-cf-text-2">{release.annotation}</p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {resume ? (
                <>
                  <Link
                    href={getChapterUrl(release.slug, edition, resume.chapterNumber)}
                    className="inline-flex h-12 items-center gap-2 bg-cf-accent px-5 text-sm font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#b81e1e]"
                  >
                    {isAudio ? <Play className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                    Читать с прокруткой  — {isAudio ? 'трек' : 'глава'} {resume.chapterNumber}
                    <span className="opacity-70">· {resume.percent}%</span>
                  </Link>

                  <Link
                    href={`/vvvvv/${edition.id}`}
                    className="inline-flex h-12 items-center gap-2 border border-cf-text-1/18 px-5 text-sm font-bold uppercase text-cf-text-1 transition-colors hover:bg-cf-text-1/8"
                  >
                    <BookOpen className="h-4 w-4" />
                    Читать в книжном формате — {isAudio ? 'трек' : 'глава'} {resume.chapterNumber}
                    <span className="opacity-70">· {resume.percent}%</span>
                  </Link>
                </>
              ) : (
                <Link
                  href={firstChapterUrl}
                  className="inline-flex h-12 items-center gap-2 bg-cf-accent px-5 text-sm font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#b81e1e]"
                >
                  {isAudio ? <Play className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                  {isAudio ? 'Слушать' : 'Читать'}
                </Link>
              )}

              {resume && (
                <Link
                  href={firstChapterUrl}
                  className="inline-flex h-12 items-center border border-cf-text-1/18 px-5 text-sm font-bold uppercase text-cf-text-1 transition-colors hover:bg-cf-text-1/8"
                >
                  С начала
                </Link>
              )}

              {!isAudio && (
                <Link
                  href={getEditionFullUrl(release.slug, edition)}
                  className="inline-flex h-12 items-center gap-2 border border-cf-text-1/18 px-5 text-sm font-bold uppercase text-cf-text-1 transition-colors hover:bg-cf-text-1/8"
                >
                  <ScrollText className="h-4 w-4" />
                  Одним файлом
                </Link>
              )}
            </div>

            {isAdmin && (
              <div className="mt-4">
                <Link
                  href={`/studio/editions/${edition.id}`}
                  className="inline-flex items-center gap-1.5 rounded border border-cf-text-1/15 bg-cf-text-1/6 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 transition-colors hover:border-cf-accent hover:bg-cf-accent/10 hover:text-cf-accent"
                >
                  <Pen className="h-3 w-3" />
                  Studio
                </Link>
              </div>
            )}

            {otherEditions.length > 0 && (
              <div className="mt-8">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cf-text-3">
                  Другие издания
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {otherEditions.map(other => (
                    <Link
                      key={other.id}
                      href={getEditionTocUrl(release.slug, other)}
                      className="inline-flex items-center gap-2 rounded-full border border-cf-text-1/15 px-4 py-2 text-xs font-bold text-cf-text-2 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-1"
                    >
                      {getEditionLabel(other)}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <TocList
        release={release}
        edition={edition}
        chapters={chapters}
        isAudio={isAudio}
        accent={accent}
        progressByChapter={progressByChapter}
      />

      {highlights.length > 0 && (
        <QuotesSection release={release} highlights={highlights} accent={accent} />
      )}

      <SiteFooter variant="simple" />
    </div>
  )
}

function TocList({
  release,
  edition,
  chapters,
  isAudio,
  accent,
  progressByChapter,
}: {
  release: Release
  edition: Edition
  chapters: Omit<Chapter, 'content'>[]
  isAudio: boolean
  accent: string
  progressByChapter: Record<string, number>
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8">
      <h2
        id="toc"
        className="border-b border-cf-text-1/10 pb-4 text-2xl font-black uppercase leading-none text-cf-text-heading sm:text-3xl"
      >
        Оглавление
      </h2>

      <ol className="mt-2">
        {chapters.map((chapter, index) => {
          const percent = progressByChapter[chapter.id] ?? 0
          const isDone = percent >= 95
          return (
            <li key={chapter.id}>
              <Link
                href={getChapterUrl(release.slug, edition, index + 1)}
                className="group flex items-baseline gap-4 border-b border-cf-text-1/10 py-4 transition-colors hover:bg-cf-text-1/[0.03]"
              >
                <span
                  className="min-w-[2ch] text-xs font-black tabular-nums text-cf-text-4"
                  style={isDone ? { color: accent } : undefined}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className="flex-1 leading-snug text-cf-text-1 group-hover:text-cf-text-heading">
                  {chapter.title}
                </span>

                <span className="shrink-0 text-xs tabular-nums text-cf-text-3">
                  {isAudio
                    ? chapter.duration_seconds
                      ? formatDuration(chapter.duration_seconds)
                      : ''
                    : chapter.word_count > 0
                      ? formatReadingTime(Math.max(1, Math.round(chapter.word_count / 200)))
                      : ''}
                </span>

                {percent > 0 && (
                  <span
                    className="shrink-0 text-[10px] font-black uppercase tabular-nums"
                    style={{ color: accent }}
                  >
                    {isDone ? '✓' : `${Math.round(percent)}%`}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function QuotesSection({
  release,
  highlights,
  accent,
}: {
  release: Release
  highlights: ChapterHighlight[]
  accent: string
}) {
  return (
    <section className="border-t border-cf-text-1/10">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
          Что подчёркивают читатели
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {highlights.map(highlight => (
            <Link
              key={highlight.id}
              href={`/release/${release.slug}/highlight/${highlight.id}`}
              className="group border-l-2 pl-4 transition-opacity hover:opacity-80"
              style={{ borderColor: accent }}
            >
              <p className="font-[family-name:var(--font-cormorant)] text-lg italic leading-snug text-cf-text-caption">
                «{highlight.text_content}»
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-cf-text-3">
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
      </div>
    </section>
  )
}
