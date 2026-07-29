'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Edition, Chapter, Release, ReleaseDesignConfig } from '@/lib/releases-types'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, List } from 'lucide-react'

const defaultConfig: ReleaseDesignConfig = {
  accent_color: '#d52525',
  bg_color: '#111210',
  text_color: '#f4efe5',
  layout: 'narrow',
  show_toc: true,
}

const chapterLabels: Record<string, string> = {
  book: 'Глава', comic: 'Глава', audiobook: 'Трек',
  audiorelease: 'Трек', album: 'Трек', magazine: 'Статья',
}

function getChapterUrl(release: { slug: string }, edition: Edition, chapterNum: number): string {
  if (edition.format === 'book') {
    return `/release/${release.slug}/book/${edition.quality_tier}/${chapterNum}`
  }
  return `/release/${release.slug}/${edition.slug}/${chapterNum}`
}

export function ReleaseReader({ release, edition, chapters, chapterIndex }: {
  release: Release
  edition: Edition
  chapters: Chapter[]
  chapterIndex: number
}) {
  const config = release.design_config ?? {}
  const accent = config.accent_color ?? defaultConfig.accent_color!
  const bg = config.bg_color ?? defaultConfig.bg_color!
  const text = config.text_color ?? defaultConfig.text_color!
  const layout = config.layout ?? defaultConfig.layout!
  const showToc = config.show_toc ?? defaultConfig.show_toc!

  const [tocOpen, setTocOpen] = useState(false)
  const currentChapter = useMemo(() => chapters[chapterIndex], [chapterIndex, chapters])

  const maxWidth = layout === 'wide' ? 'max-w-4xl' : 'max-w-2xl'
  const chapterLabel = chapterLabels[edition.format] ?? 'Глава'

  const publishedChapters = chapters.filter(c => c.status === 'published')

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, color: text }}>
      <header className="sticky top-0 z-40 border-b" style={{ borderColor: `${text}15`, backgroundColor: bg }}>
        <div className={`mx-auto flex items-center gap-3 px-6 py-3 ${maxWidth}`}>
          <Link href={`/release/${release.slug}`}>
            <Button variant="ghost" size="icon" style={{ color: text }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: accent }}>{release.title}</p>
            <p className="text-xs opacity-60 truncate">{currentChapter?.title ?? `${chapterLabel} ${chapterIndex + 1}`}</p>
          </div>

          {showToc && publishedChapters.length > 1 && (
            <Button variant="ghost" size="icon" onClick={() => setTocOpen(!tocOpen)} style={{ color: text }}>
              <List className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {showToc && tocOpen && publishedChapters.length > 1 && (
        <nav className="border-b" style={{ borderColor: `${text}15` }}>
          <div className={`mx-auto px-6 py-4 ${maxWidth}`}>
            <div className="grid gap-1">
              {publishedChapters.map((ch, i) => (
                <Link
                  key={ch.id}
                  href={getChapterUrl(release, edition, i + 1)}
                  className="px-3 py-2 rounded text-sm transition-colors"
                  style={{
                    color: i === chapterIndex ? accent : text,
                    backgroundColor: i === chapterIndex ? `${accent}15` : 'transparent',
                  }}
                >
                  {ch.title}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      )}

      <div className={`mx-auto px-6 py-8 ${maxWidth}`}>
        {currentChapter?.content ? (
          <div
            className="prose prose-lg max-w-none leading-7 prose-p:mb-5"
            dangerouslySetInnerHTML={{ __html: currentChapter.content ?? '' }}
          />
        ) : (
          <div className="text-center opacity-40 py-16">
            Содержимое ещё не добавлено
          </div>
        )}
      </div>

      {publishedChapters.length > 1 && (
        <div className={`mx-auto flex items-center justify-between px-6 py-4 border-t ${maxWidth}`} style={{ borderColor: `${text}15` }}>
          {chapterIndex > 0 ? (
            <Link href={getChapterUrl(release, edition, chapterIndex)}>
              <Button variant="outline" style={{ borderColor: `${accent}40`, color: text }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {publishedChapters[chapterIndex - 1]?.title ?? `${chapterLabel} ${chapterIndex}`}
              </Button>
            </Link>
          ) : (
            <div />
          )}
          {chapterIndex < publishedChapters.length - 1 ? (
            <Link href={getChapterUrl(release, edition, chapterIndex + 2)}>
              <Button style={{ backgroundColor: accent, color: bg }}>
                {publishedChapters[chapterIndex + 1]?.title ?? `${chapterLabel} ${chapterIndex + 2}`}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  )
}