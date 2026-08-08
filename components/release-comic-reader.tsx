'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Maximize, Minimize, List, X } from 'lucide-react'
import type { Release, Edition, Chapter } from '@/lib/releases-types'

interface ReleaseComicReaderProps {
  release: Release
  edition: Edition
  chapters: Chapter[]
}

// Страницы комикса хранятся в chapter.content как JSON-массив URL
function parseComicPages(content: string | null): string[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {}
  return []
}

export function ReleaseComicReader({ release, chapters }: ReleaseComicReaderProps) {
  const accent = release.design_config?.accent_color ?? '#d52525'

  // Собираем все страницы из всех глав в плоский список с метой
  const allPages = chapters.flatMap((ch, chIndex) =>
    parseComicPages(ch.content).map((url, pageIndex) => ({
      url,
      chapterTitle: ch.title,
      chapterIndex: chIndex,
      pageIndex,
    })),
  )

  const [currentPage, setCurrentPage] = useState(0)
  const [showUI, setShowUI] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showChapterList, setShowChapterList] = useState(false)
  const uiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  const progress = allPages.length > 1 ? (currentPage / (allPages.length - 1)) * 100 : 100

  const resetUiTimer = useCallback(() => {
    setShowUI(true)
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current)
    uiTimerRef.current = setTimeout(() => setShowUI(false), 3000)
  }, [])

  // Intersection Observer
  useEffect(() => {
    if (allPages.length === 0) return
    const observers: IntersectionObserver[] = []
    pageRefs.current.forEach((el, index) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting && entry.intersectionRatio > 0.3) setCurrentPage(index) },
        { threshold: 0.3 },
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(obs => obs.disconnect())
  }, [allPages.length])

  // Scroll/touch → сброс таймера UI
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', resetUiTimer, { passive: true })
    el.addEventListener('touchstart', resetUiTimer, { passive: true })
    return () => { el.removeEventListener('scroll', resetUiTimer); el.removeEventListener('touchstart', resetUiTimer) }
  }, [resetUiTimer])

  const scrollToPage = useCallback((index: number) => {
    pageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToChapter = (chapterIndex: number) => {
    const firstPageOfChapter = allPages.findIndex(p => p.chapterIndex === chapterIndex)
    if (firstPageOfChapter >= 0) scrollToPage(firstPageOfChapter)
    setShowChapterList(false)
  }

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen()
    }
  }, [])

  // Клавиатура
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') scrollToPage(Math.min(allPages.length - 1, currentPage + 1))
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') scrollToPage(Math.max(0, currentPage - 1))
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentPage, allPages.length, scrollToPage, toggleFullscreen])

  // Fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (allPages.length === 0) {
    return (
      <div className="min-h-screen bg-cf-bg flex items-center justify-center">
        <p className="text-cf-text-4 text-sm">Страницы не добавлены</p>
      </div>
    )
  }

  const currentMeta = allPages[currentPage]

  return (
    <div className="relative bg-[#0a0a09] min-h-screen" onClick={resetUiTimer}>
      {/* Прогресс-бар */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-white/8">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: accent }}
        />
      </div>

      {/* Верхний UI */}
      <header
        className={`fixed top-0.5 left-0 right-0 z-40 transition-all duration-300 ${
          showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium truncate max-w-[180px]">{release.title}</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 tabular-nums">
              {currentPage + 1} / {allPages.length}
            </span>
            {chapters.length > 1 && (
              <button
                onClick={() => setShowChapterList(true)}
                className="p-2 text-white/60 hover:text-white transition-colors"
                aria-label="Главы"
              >
                <List className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-white/60 hover:text-white transition-colors"
              aria-label={isFullscreen ? 'Выйти из полного экрана' : 'Полный экран'}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Название главы при смене */}
      {chapters.length > 1 && currentMeta && (
        <div
          className={`fixed top-12 left-0 right-0 z-30 flex justify-center transition-all duration-300 pointer-events-none ${
            showUI ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span
            className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em]"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            {currentMeta.chapterTitle}
          </span>
        </div>
      )}

      {/* Страницы */}
      <div ref={containerRef} className="w-full">
        {allPages.map((page, index) => (
          <div
            key={index}
            ref={el => { pageRefs.current[index] = el }}
            className="relative w-full flex justify-center"
          >
            {Math.abs(index - currentPage) <= 3 ? (
              <Image
                src={page.url}
                alt={`Страница ${index + 1}`}
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, 720px"
                className="w-full max-w-[720px] block object-cover"
              />
            ) : (
              <div className="w-full max-w-[720px] bg-[#111210]" style={{ aspectRatio: '3/4', minHeight: 400 }} />
            )}
          </div>
        ))}

        {/* Конец */}
        <div className="flex flex-col items-center gap-6 py-16 px-4 max-w-[720px] mx-auto">
          <div className="w-12 h-px bg-white/20" />
          <p className="text-white/40 text-xs uppercase tracking-[0.18em]">Конец</p>
          <Link
            href="/"
            className="text-white/40 hover:text-white text-xs uppercase tracking-[0.18em] transition-colors"
          >
            ← Все релизы
          </Link>
        </div>
      </div>

      {/* Нижний UI */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
          showUI ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={() => scrollToPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-2 text-white/60 hover:text-white disabled:opacity-20 transition-colors"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Миниатюры */}
          <div className="flex-1 overflow-x-auto mx-2 [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-1.5 justify-center">
              {allPages.map((page, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i)}
                  className={`flex-shrink-0 w-8 h-10 overflow-hidden border transition-all ${
                    i === currentPage
                      ? 'opacity-100 scale-110'
                      : 'border-white/10 opacity-40 hover:opacity-70'
                  }`}
                  style={i === currentPage ? { borderColor: accent } : {}}
                  aria-label={`Страница ${i + 1}`}
                >
                  <Image src={page.url} alt={`Страница ${i + 1}`} fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => scrollToPage(Math.min(allPages.length - 1, currentPage + 1))}
            disabled={currentPage === allPages.length - 1}
            className="p-2 text-white/60 hover:text-white disabled:opacity-20 transition-colors"
            aria-label="Следующая страница"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Список глав */}
      {showChapterList && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setShowChapterList(false)} />
          <aside className="flex w-64 flex-col bg-[#0f0f0e] border-l border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">Главы</h2>
              <button onClick={() => setShowChapterList(false)} className="p-1 text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => scrollToChapter(i)}
                  className={`flex w-full items-center gap-3 border-b border-white/6 px-4 py-3 text-left hover:bg-white/4 transition-colors ${
                    currentMeta?.chapterIndex === i ? 'bg-white/6' : ''
                  }`}
                >
                  <span
                    className="text-xs font-black tabular-nums"
                    style={{ color: currentMeta?.chapterIndex === i ? accent : 'rgba(255,255,255,0.4)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-sm truncate ${currentMeta?.chapterIndex === i ? 'text-white' : 'text-white/60'}`}>
                    {ch.title}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
