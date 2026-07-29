'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { X, AlignJustify, Bookmark, BookmarkPlus, Heart, ChevronLeft, ChevronRight, Sun, Moon, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { useColumnPagination, SPINE_WIDTH } from '@/lib/reader/use-column-pagination'
import {
  collectParagraphs,
  clearHighlightMarks,
  wrapHighlight,
  pageOfElement,
  findTextRange,
  PARAGRAPH_TAGS,
} from '@/lib/reader/highlights-dom'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { HighlightArtifact } from '@/components/highlight-artifact'
import type { Release, Edition, Chapter, ChapterHighlight } from '@/lib/releases-types'
import type { UserRole } from '@/lib/types'

// ─── Темы ────────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light' | 'sepia'

const THEMES: Record<Theme, { bg: string; bg2: string; text: string; text2: string; shadow: string }> = {
  dark:  { bg: '#0c0b0a', bg2: '#1d1c18', text: '#f0ebe0', text2: '#cec8bb', shadow: 'rgba(0,0,0,0.6)' },
  light: { bg: '#d6cfc3', bg2: '#f0ebe0', text: '#1a1816', text2: '#3d3830', shadow: 'rgba(0,0,0,0.15)' },
  sepia: { bg: '#2a2318', bg2: '#312a1e', text: '#e8d9bb', text2: '#c8b894', shadow: 'rgba(0,0,0,0.5)' },
}

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface SelectionData {
  text: string
  rect: DOMRect
  paragraphIndex: number
  contextBefore: string
  contextAfter: string
}

export interface SpreadReaderProps {
  release: Release
  edition: Edition
  chapters: Chapter[]
  currentUserId: string | null
  initialHighlights: ChapterHighlight[]
  userRole: UserRole | null
  userName: string | null
  initialChapterIndex?: number
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export function SpreadReader({
  release,
  edition,
  chapters,
  currentUserId,
  initialHighlights,
  userRole,
  initialChapterIndex = 0,
}: SpreadReaderProps) {
  const accent = release.design_config?.accent_color ?? '#d52525'

  // Тема и шрифт (сохраняем в localStorage)
  const [theme, setTheme] = useState<Theme>('dark')
  const [fontSize, setFontSize] = useState(18)

  useEffect(() => {
    const t = localStorage.getItem('canfly-reader-theme') as Theme | null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing theme from localStorage
    if (t && t in THEMES) setTheme(t)
    const f = localStorage.getItem('canfly-reader-fontsize')
    if (f) {
      const n = parseInt(f, 10)
      if (n >= 14 && n <= 26) setFontSize(n)
    }
  }, [])

  const applyTheme = (t: Theme) => {
    setTheme(t)
    localStorage.setItem('canfly-reader-theme', t)
  }
  const applyFontSize = (f: number) => {
    setFontSize(f)
    localStorage.setItem('canfly-reader-fontsize', String(f))
  }

  const t = THEMES[theme]

  // Навигация по главам
  const [currentIndex, setCurrentIndex] = useState(initialChapterIndex)
  const currentChapter = chapters[currentIndex]

  // Хайлайты
  const [highlights, setHighlights] = useState<ChapterHighlight[]>(initialHighlights)
  const [selection, setSelection] = useState<SelectionData | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<ChapterHighlight | null>(null)
  const [artifactOpen, setArtifactOpen] = useState(false)
  const [artifactRect, setArtifactRect] = useState<DOMRect | null>(null)

  // UI-панели
  const [showToc, setShowToc] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showThemes, setShowThemes] = useState(false)

  // Навигация к закладке из другой главы
  const [pendingHighlightNav, setPendingHighlightNav] = useState<{ paragraphIndex: number; chapterId: string } | null>(null)
  // При переходе назад — хотим открыть последнюю страницу главы
  const [pendingLastPage, setPendingLastPage] = useState(false)

  // Refs
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const floatingMenuRef = useRef<HTMLDivElement>(null)

  // Пагинация
  const {
    pageCount,
    currentPage,
    isSpread,
    pageWidth,
    pageHeight,
    gutter,
    setCurrentPage,
    remeasure,
  } = useColumnPagination(viewportRef, trackRef, fontSize, currentChapter?.id ?? '')

  // Перерегистрируем img.onload при смене главы для remeasure после загрузки картинок
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const imgs = content.querySelectorAll('img')
    imgs.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', remeasure, { once: true })
      }
    })
  }, [currentChapter?.id, remeasure])

  // Вычисленные
  const pagesPerView = isSpread ? 2 : 1
  const maxPage = Math.max(0, pageCount - pagesPerView)
  const pageOffset = currentPage * (pageWidth + gutter)

  // Хайлайты текущей главы
  const chapterHighlights = useMemo(
    () => highlights.filter(h => h.chapter_id === currentChapter?.id),
    [highlights, currentChapter],
  )

  const myHighlights = useMemo(
    () => currentUserId
      ? highlights
          .filter(h => h.user_id === currentUserId)
          .sort((a, b) => (a.paragraph_index ?? 0) - (b.paragraph_index ?? 0))
      : [],
    [highlights, currentUserId],
  )

  // Прогресс
  const intraChapter = pageCount > 1 ? currentPage / (pageCount - 1) : 1
  const progress = Math.round(((currentIndex + intraChapter) / chapters.length) * 100)

  // ── Загрузка хайлайтов при смене главы ──
  useEffect(() => {
    if (!currentChapter) return
    if (highlights.some(h => h.chapter_id === currentChapter.id)) return
    let cancelled = false
    fetch(`/api/chapter-highlights?chapterId=${currentChapter.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.data) return
        setHighlights(prev => {
          const ids = new Set(prev.map(h => h.id))
          return [...prev, ...data.data.filter((h: ChapterHighlight) => !ids.has(h.id))]
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [currentChapter?.id])

  // ── Применяем хайлайты к DOM ──
  useEffect(() => {
    const root = contentRef.current
    if (!root || !currentChapter) return
    clearHighlightMarks(root)
    const paragraphs = collectParagraphs(root)
    const hlByParagraph = new Map<number, ChapterHighlight[]>()
    for (const hl of chapterHighlights) {
      if (hl.paragraph_index == null) continue
      const arr = hlByParagraph.get(hl.paragraph_index) ?? []
      arr.push(hl)
      hlByParagraph.set(hl.paragraph_index, arr)
    }
    paragraphs.forEach((p, idx) => {
      const list = hlByParagraph.get(idx)
      if (!list) return
      for (const hl of list) wrapHighlight(p, hl, currentUserId, accent)
    })
  }, [currentChapter?.id, chapterHighlights, currentIndex, accent, currentUserId])

  // ── Клик по <mark> ──
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName !== 'MARK') return
      if (target.dataset.cfHl) {
        const hl = chapterHighlights.find(h => h.id === target.dataset.cfHl)
        if (hl) setActiveHighlight(hl)
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [chapterHighlights])

  // ── Сохранение прогресса ──
  useEffect(() => {
    if (!currentUserId || !currentChapter) return
    const timer = setTimeout(() => {
      fetch('/api/reading-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editionId: edition.id,
          chapterId: currentChapter.id,
          progressPercent: progress,
        }),
        keepalive: true,
      }).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [currentUserId, currentChapter?.id, edition.id, progress])

  // ── Сброс страницы и selection при смене главы ──
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection/artifact on chapter change
    setSelection(null)
    setArtifactOpen(false)
  }, [currentIndex])

  // ── После remeasure: восстановить последнюю страницу (переход назад) ──
  useEffect(() => {
    if (!pendingLastPage || pageCount <= 1) return
    const lastPage = isSpread
      ? Math.floor((pageCount - 2) / 2) * 2
      : pageCount - 1
    setCurrentPage(Math.max(0, lastPage))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore last page on back navigation
    setPendingLastPage(false)
  }, [pendingLastPage, pageCount, isSpread, setCurrentPage])

  // ── После смены главы: навигация к закладке ──
  useEffect(() => {
    if (!pendingHighlightNav) return
    if (currentChapter?.id !== pendingHighlightNav.chapterId) return
    const timer = setTimeout(() => {
      const root = contentRef.current
      const track = trackRef.current
      if (!root || !track) { setPendingHighlightNav(null); return }
      const paragraphs = collectParagraphs(root)
      const el = paragraphs[pendingHighlightNav.paragraphIndex]
      if (el) {
        const page = pageOfElement(el, track, pageWidth, gutter, isSpread)
        setCurrentPage(page)
      }
      setPendingHighlightNav(null)
    }, 350)
    return () => clearTimeout(timer)
  }, [currentChapter?.id, pendingHighlightNav, pageWidth, gutter, isSpread, setCurrentPage])

  // ── Навигация ──
  const goNext = useCallback(() => {
    const next = currentPage + pagesPerView
    if (next <= maxPage) {
      setCurrentPage(next)
    } else if (currentIndex < chapters.length - 1) {
      setCurrentIndex(i => i + 1)
      setCurrentPage(0)
    }
  }, [currentPage, pagesPerView, maxPage, currentIndex, chapters.length, setCurrentPage])

  const goPrev = useCallback(() => {
    const prev = currentPage - pagesPerView
    if (prev >= 0) {
      setCurrentPage(prev)
    } else if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setPendingLastPage(true)
      setCurrentPage(0)
    }
  }, [currentPage, pagesPerView, currentIndex, setCurrentPage])

  // ── Клавиатура ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  // ── Свайп на mobile ──
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    let startX = 0
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onTouchEnd = (e: TouchEvent) => {
      const dx = startX - e.changedTouches[0].clientX
      if (Math.abs(dx) > 50) {
        if (dx > 0) goNext()
        else goPrev()
      }
    }
    vp.addEventListener('touchstart', onTouchStart, { passive: true })
    vp.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      vp.removeEventListener('touchstart', onTouchStart)
      vp.removeEventListener('touchend', onTouchEnd)
    }
  }, [goNext, goPrev])

  // ── Выделение текста → хайлайт ──
  const handleMouseUp = useCallback(() => {
    if (!currentUserId) return
    if (floatingMenuRef.current?.contains(document.activeElement)) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const text = sel.toString().trim()
    if (text.length < 3) { setSelection(null); return }
    if (!contentRef.current?.contains(sel.anchorNode)) return

    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    let node: Node | null = sel.anchorNode
    let paragraphEl: HTMLElement | null = null
    while (node && node !== contentRef.current) {
      if (node instanceof HTMLElement && PARAGRAPH_TAGS.includes(node.tagName.toLowerCase())) {
        paragraphEl = node; break
      }
      node = node.parentNode
    }

    let paragraphIndex = -1
    if (paragraphEl && contentRef.current) {
      const paragraphs = collectParagraphs(contentRef.current)
      paragraphIndex = paragraphs.indexOf(paragraphEl)
    }

    const fullText = paragraphEl?.textContent ?? ''
    const offset = fullText.indexOf(text)
    const contextBefore = offset >= 0 ? fullText.slice(Math.max(0, offset - 30), offset) : ''
    const contextAfter = offset >= 0 ? fullText.slice(offset + text.length, offset + text.length + 30) : ''

    setSelection({ text, rect, paragraphIndex, contextBefore, contextAfter })
  }, [currentUserId])

  // ── Навигация к закладке ──
  const scrollToHighlight = useCallback((paragraphIndex: number, chapterId: string) => {
    const targetIndex = chapters.findIndex(ch => ch.id === chapterId)
    if (targetIndex === -1) return

    if (targetIndex === currentIndex) {
      // Та же глава — просто перелистать к нужной странице
      const root = contentRef.current
      const track = trackRef.current
      if (root && track) {
        const paragraphs = collectParagraphs(root)
        const el = paragraphs[paragraphIndex]
        if (el) {
          const page = pageOfElement(el, track, pageWidth, gutter, isSpread)
          setCurrentPage(page)
        }
      }
    } else {
      setPendingHighlightNav({ paragraphIndex, chapterId })
      setCurrentIndex(targetIndex)
      setCurrentPage(0)
      setShowBookmarks(false)
    }
  }, [chapters, currentIndex, pageWidth, gutter, isSpread, setCurrentPage])

  const deleteHighlight = useCallback(async (id: string) => {
    const res = await fetch(`/api/chapter-highlights/${id}`, { method: 'DELETE' })
    if (res.ok) setHighlights(prev => prev.filter(h => h.id !== id))
  }, [])

  const toggleLike = async (id: string) => {
    if (!currentUserId) { toast.error('Войдите чтобы ставить лайки'); return }
    const res = await fetch(`/api/chapter-highlights/${id}/like`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setHighlights(prev => prev.map(h =>
        h.id === id ? { ...h, is_liked_by_me: data.data.liked, likes_count: data.data.likes_count } : h,
      ))
      if (activeHighlight?.id === id) {
        setActiveHighlight(prev => prev ? { ...prev, is_liked_by_me: data.data.liked, likes_count: data.data.likes_count } : null)
      }
    }
  }

  // ── Пустое состояние ──
  if (chapters.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: t.bg }}>
        <p className="text-sm" style={{ color: t.text2 }}>Содержимое ещё не опубликовано</p>
      </div>
    )
  }

  const spreadWidth = isSpread ? pageWidth * 2 + gutter : pageWidth
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count ?? 0), 0)

  return (
    <div
      className="fixed inset-0 select-none"
      style={{ backgroundColor: t.bg, transition: 'background-color 0.4s' }}
    >
      {/* ── Прогресс-бар ── */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px" style={{ backgroundColor: `${accent}22` }}>
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${progress}%`, backgroundColor: accent }}
        />
      </div>

      {/* ── Back link ── */}
      <Link
        href={`/release/${release.slug}`}
        className="fixed left-4 top-4 z-50 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] transition-opacity hover:opacity-60"
        style={{ color: t.text2 }}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline max-w-[120px] truncate">{release.title}</span>
      </Link>

      {/* ── Тулбар — вертикальный, по правому краю ── */}
      <aside
        className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-px"
        style={{
          backgroundColor: `${t.bg2}ee`,
          border: `1px solid ${t.text}12`,
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Размер шрифта A- */}
        <ToolbarBtn
          onClick={() => applyFontSize(Math.max(14, fontSize - 2))}
          title="Уменьшить шрифт"
          textColor={t.text}
        >
          <span className="text-[11px] font-black">A−</span>
        </ToolbarBtn>

        {/* Размер шрифта A+ */}
        <ToolbarBtn
          onClick={() => applyFontSize(Math.min(26, fontSize + 2))}
          title="Увеличить шрифт"
          textColor={t.text}
        >
          <span className="text-[13px] font-black">A+</span>
        </ToolbarBtn>

        <div className="mx-2 h-px" style={{ backgroundColor: `${t.text}15` }} />

        {/* Оглавление */}
        {chapters.length > 1 && (
          <ToolbarBtn onClick={() => setShowToc(true)} title="Оглавление" textColor={t.text}>
            <AlignJustify className="h-4 w-4" />
          </ToolbarBtn>
        )}

        {/* Закладки */}
        {currentUserId && (
          <ToolbarBtn
            onClick={() => setShowBookmarks(b => !b)}
            title="Закладки"
            textColor={showBookmarks ? accent : t.text}
          >
            <Bookmark
              className="h-4 w-4"
              style={{ fill: myHighlights.length > 0 ? 'currentColor' : 'none' }}
            />
          </ToolbarBtn>
        )}

        <div className="mx-2 h-px" style={{ backgroundColor: `${t.text}15` }} />

        {/* Тема */}
        <ToolbarBtn
          onClick={() => setShowThemes(b => !b)}
          title="Тема"
          textColor={showThemes ? accent : t.text}
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Palette className="h-4 w-4" />}
        </ToolbarBtn>

        {/* Выбор темы — абсолютно позиционированный вправо от тулбара (влево!) */}
        {showThemes && (
          <div
            className="absolute right-full top-1/2 mr-1.5 flex -translate-y-1/2 flex-col gap-1 rounded-sm p-2"
            style={{ backgroundColor: `${t.bg2}f0`, border: `1px solid ${t.text}12`, backdropFilter: 'blur(16px)' }}
          >
            {(['dark', 'light', 'sepia'] as Theme[]).map(th => (
              <button
                key={th}
                onClick={() => { applyTheme(th); setShowThemes(false) }}
                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition-opacity hover:opacity-60"
                style={{ color: theme === th ? accent : t.text2 }}
              >
                <span className="h-3 w-3 rounded-full border" style={{
                  backgroundColor: THEMES[th].bg2,
                  borderColor: `${t.text}40`,
                  boxShadow: `0 0 0 1px ${theme === th ? accent : 'transparent'}`,
                }} />
                {th === 'dark' ? 'Тёмная' : th === 'light' ? 'Светлая' : 'Сепия'}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── Книжная зона ── */}
      <div
        className="fixed inset-0"
        style={{ top: 0, bottom: 0, left: 0, right: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Стрелка влево */}
        <button
          onClick={goPrev}
          disabled={currentPage === 0 && currentIndex === 0}
          className="relative z-10 flex h-full w-12 shrink-0 items-center justify-center opacity-0 transition-opacity hover:opacity-100 disabled:pointer-events-none"
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: t.text2 }} />
        </button>

        {/* ── Книга (viewport) — заполняет весь экран ── */}
        <div className="relative flex-1" style={{ height: '100%', overflow: 'hidden' }}>
          {/* Тень книги */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              width: spreadWidth,
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: `0 32px 80px ${t.shadow}, 0 8px 24px ${t.shadow}`,
              borderRadius: 1,
            }}
          />

          {/* Viewport с overflow:hidden */}
          <div
            ref={viewportRef}
            className="relative"
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              backgroundColor: t.bg2,
              cursor: 'text',
              userSelect: 'text',
            }}
          >
            {/* Track — CSS-columns, moves via transform */}
            <div
              ref={trackRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                columnWidth: pageWidth > 0 ? pageWidth : undefined,
                columnGap: gutter,
                columnFill: 'auto',
                willChange: 'transform',
                transform: `translateX(-${pageOffset}px)`,
                transition: 'transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)',
                padding: '40px 0',
                boxSizing: 'border-box',
              }}
            >
              {/* Заголовок главы — паджинируется вместе с текстом */}
              <div
                style={{ breakInside: 'avoid', marginBottom: '2em' }}
              >
                {chapters.length > 1 && (
                  <p
                    className="mb-2 text-[10px] font-black uppercase tracking-[0.28em]"
                    style={{ color: accent }}
                  >
                    {currentIndex === 0 && release.genre ? release.genre : `Глава ${currentIndex + 1}`}
                  </p>
                )}
                <h2
                  className="text-2xl font-black uppercase leading-tight"
                  style={{ fontFamily: 'var(--font-sans)', color: t.text }}
                >
                  {currentChapter?.title}
                </h2>
                {currentIndex === 0 && release.annotation && (
                  <p
                    className="mt-3 text-sm leading-7 opacity-55"
                    style={{ color: t.text, fontFamily: 'var(--font-cormorant)', fontSize: '15px' }}
                  >
                    {release.annotation}
                  </p>
                )}
                {currentIndex === 0 && (
                  <div className="mt-3 flex items-center gap-4">
                    {release.authors.length > 0 && (
                      <span className="text-[10px] uppercase tracking-[0.18em] opacity-40" style={{ color: t.text }}>
                        {release.authors.map(a => a.name).join(', ')}
                      </span>
                    )}
                    {totalWords > 0 && (
                      <span className="text-[10px] opacity-30" style={{ color: t.text }}>
                        ~{Math.ceil(totalWords / 200)} мин
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-5 h-px w-8 opacity-20" style={{ backgroundColor: t.text }} />
              </div>

              {/* Контент главы */}
              {currentChapter?.content ? (
                <div
                  ref={contentRef}
                  onMouseUp={handleMouseUp}
                  className="prose max-w-none"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.85,
                    color: t.text,
                    fontFamily: 'var(--font-cormorant)',
                    ['--tw-prose-body' as string]: t.text,
                    ['--tw-prose-headings' as string]: t.text,
                    ['--tw-prose-links' as string]: accent,
                    ['--tw-prose-bold' as string]: t.text,
                    ['--tw-prose-quotes' as string]: t.text,
                    ['--tw-prose-hr' as string]: `${t.text}20`,
                  }}
                  dangerouslySetInnerHTML={{ __html: currentChapter.content ?? '' }}
                />
              ) : (
                <p className="py-8 text-center text-sm opacity-40" style={{ color: t.text }}>
                  Содержимое главы ещё не добавлено
                </p>
              )}
            </div>

            {/* ── Корешок (spine) — только на desktop ── */}
            {isSpread && gutter > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{
                  left: pageWidth,
                  width: gutter,
                  background: `linear-gradient(90deg,
                    rgba(0,0,0,0.28) 0%,
                    rgba(0,0,0,0.08) 35%,
                    transparent 50%,
                    rgba(0,0,0,0.04) 65%,
                    rgba(0,0,0,0.20) 100%)`,
                  zIndex: 5,
                }}
              >
                {/* Тонкая линия корешка */}
                <div
                  className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
                  style={{ backgroundColor: `${t.text}08` }}
                />
              </div>
            )}

            {/* Левая page-shadow (только в spread) */}
            {isSpread && (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-6"
                style={{
                  background: `linear-gradient(90deg, rgba(0,0,0,0.15), transparent)`,
                  zIndex: 4,
                }}
              />
            )}
          </div>

          {/* Номера страниц под каждой страницей */}
          {pageHeight > 0 && pageCount > 1 && (
            <div
              className="pointer-events-none absolute flex items-center"
              style={{
                top: pageHeight + 12,
                left: '50%',
                transform: 'translateX(-50%)',
                width: spreadWidth,
              }}
            >
              {/* Левая страница */}
              <span
                className="flex-1 text-center text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: `${t.text2}50` }}
              >
                {currentPage + 1}
              </span>
              {isSpread && (
                <span
                  className="flex-1 text-center text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: `${t.text2}50` }}
                >
                  {currentPage + 2 <= pageCount ? currentPage + 2 : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Стрелка вправо */}
        <button
          onClick={goNext}
          disabled={currentPage >= maxPage && currentIndex === chapters.length - 1}
          className="relative z-10 flex h-full w-12 shrink-0 items-center justify-center opacity-0 transition-opacity hover:opacity-100 disabled:pointer-events-none"
          aria-label="Следующая страница"
        >
          <ChevronRight className="h-5 w-5" style={{ color: t.text2 }} />
        </button>
      </div>

      {/* ── Floating selection pill ── */}
      {selection && !artifactOpen && (
        <div
          ref={floatingMenuRef}
          className="fixed z-[100] flex items-center overflow-hidden shadow-2xl"
          style={{
            top: Math.max(60, selection.rect.top - 52),
            left: Math.max(8, Math.min(window.innerWidth - 220, selection.rect.left + selection.rect.width / 2 - 104)),
            backgroundColor: '#0e0d0c',
            border: '1px solid rgba(244,239,229,0.12)',
            borderRadius: 9999,
          }}
          onMouseDown={e => e.preventDefault()}
        >
          <span
            className="pl-4 pr-2 text-[12px] italic opacity-50 select-none"
            style={{ fontFamily: 'var(--font-cormorant)', color: '#f4efe5' }}
          >
            {selection.text.length > 28 ? selection.text.slice(0, 28) + '…' : selection.text}
          </span>
          <span className="h-5 w-px" style={{ backgroundColor: 'rgba(244,239,229,0.12)' }} />
          <button
            onClick={() => { setArtifactRect(selection.rect); setArtifactOpen(true) }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-colors hover:bg-white/5"
            style={{ color: accent }}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>Артефакт</span>
          </button>
          <span className="h-5 w-px" style={{ backgroundColor: 'rgba(244,239,229,0.12)' }} />
          <button
            onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges() }}
            className="flex items-center justify-center px-3 py-2.5 opacity-40 transition-opacity hover:opacity-80"
            style={{ color: '#f4efe5' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Артефакт ── */}
      {selection && currentChapter && (
        <HighlightArtifact
          open={artifactOpen}
          text={selection.text}
          chapterTitle={currentChapter.title}
          anchorRect={artifactRect}
          releaseSlug={release.slug}
          chapterId={currentChapter.id}
          paragraphIndex={selection.paragraphIndex}
          contextBefore={selection.contextBefore}
          contextAfter={selection.contextAfter}
          currentUserId={currentUserId}
          onSaved={hl => {
            setHighlights(prev => [hl, ...prev])
            window.getSelection()?.removeAllRanges()
          }}
          onClose={() => {
            setArtifactOpen(false)
            setSelection(null)
            window.getSelection()?.removeAllRanges()
          }}
          accent={accent}
          bg={t.bg2}
          textColor={t.text}
          isEditor={userRole === 'editor' || userRole === 'admin'}
          onSaveEditorial={async () => {}}
        />
      )}

      {/* ── Попап хайлайта ── */}
      {activeHighlight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveHighlight(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md border p-6 shadow-2xl"
            style={{ backgroundColor: t.bg2, borderColor: `${t.text}18`, color: t.text }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setActiveHighlight(null)} className="absolute right-3 top-3 p-1 opacity-40 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex items-center gap-3">
              {activeHighlight.user_avatar ? (
                <img src={activeHighlight.user_avatar} alt={activeHighlight.user_name ?? ''} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}33`, color: accent }}>
                  <span className="text-sm font-black">{(activeHighlight.user_name ?? '?')[0]}</span>
                </div>
              )}
              <div>
                <p className="text-sm font-bold">{activeHighlight.user_name ?? 'Аноним'}</p>
                <p className="text-[10px] opacity-50">
                  {new Date(activeHighlight.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <blockquote
              className="border-l-2 pl-3 text-sm italic leading-relaxed opacity-80"
              style={{ borderColor: accent, fontFamily: 'var(--font-cormorant)', fontSize: '16px' }}
            >
              «{activeHighlight.text_content}»
            </blockquote>
            {activeHighlight.note && (
              <p className="mt-4 text-sm leading-relaxed">{activeHighlight.note}</p>
            )}
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => toggleLike(activeHighlight.id)}
                className="flex items-center gap-1.5 text-xs opacity-70 transition-opacity hover:opacity-100"
              >
                <Heart className="h-3.5 w-3.5" style={activeHighlight.is_liked_by_me ? { fill: accent, color: accent } : undefined} />
                <span>{activeHighlight.likes_count}</span>
              </button>
              <Link
                href={`/release/${release.slug}/highlight/${activeHighlight.id}`}
                className="text-[10px] uppercase tracking-[0.16em] opacity-50 hover:opacity-100"
                style={{ color: accent }}
              >
                Поделиться
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Оглавление ── */}
      {showToc && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowToc(false)} />
          <aside
            className="flex w-72 flex-col border-l"
            style={{ backgroundColor: t.bg2, borderColor: `${t.text}12` }}
          >
            <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: `${t.text}12` }}>
              <h2 className="text-sm font-black uppercase tracking-[0.14em]" style={{ color: t.text }}>Оглавление</h2>
              <button onClick={() => setShowToc(false)} className="p-1 opacity-40 hover:opacity-100" style={{ color: t.text }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => { setCurrentIndex(i); setCurrentPage(0); setShowToc(false) }}
                  className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors"
                  style={{
                    borderColor: `${t.text}08`,
                    backgroundColor: i === currentIndex ? `${accent}10` : 'transparent',
                  }}
                >
                  <span
                    className="mt-0.5 min-w-[20px] text-xs font-black tabular-nums"
                    style={{ color: i === currentIndex ? accent : `${t.text}40` }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p
                      className="text-sm leading-snug"
                      style={{ color: i === currentIndex ? t.text : `${t.text}70`, fontWeight: i === currentIndex ? 700 : 400 }}
                    >
                      {ch.title}
                    </p>
                    {ch.word_count > 0 && (
                      <p className="mt-0.5 text-[10px] opacity-30" style={{ color: t.text }}>
                        {ch.word_count.toLocaleString('ru-RU')} слов
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* ── Закладки ── */}
      {currentUserId && (
        <BookmarksPanel
          open={showBookmarks}
          onClose={() => setShowBookmarks(false)}
          highlights={myHighlights}
          currentChapterId={currentChapter?.id ?? ''}
          onDelete={deleteHighlight}
          onScrollTo={scrollToHighlight}
          accent={accent}
          bg={t.bg2}
          textColor={t.text}
        />
      )}
    </div>
  )
}

// ─── Вспомогательные компоненты ───────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  title,
  textColor,
  children,
}: {
  onClick: () => void
  title: string
  textColor: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-60"
      style={{ color: textColor }}
      aria-label={title}
    >
      {children}
    </button>
  )
}

// findTextRange переэкспортируем так чтобы не импортировать highlights-dom в тесте напрямую
export { findTextRange }
