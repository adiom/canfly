'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getEditionLabel } from '@/lib/utils/editions'
import { ChevronLeft, ChevronRight, X, AlignJustify, Heart, MessageCircle, Check, Bookmark, BookmarkPlus, Trash2, List, Type, Sun, Moon, Palette } from 'lucide-react'
import { toast } from 'sonner'
import type { Release, Edition, Chapter, ChapterHighlight, ChapterEditorialNote } from '@/lib/releases-types'
import type { UserRole } from '@/lib/types'
import { useEditorialNotes } from '@/lib/reader/use-editorial-notes'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { HighlightArtifact } from '@/components/highlight-artifact'
import { collectParagraphs, clearHighlightMarks, wrapHighlight, wrapEditorialNote, PARAGRAPH_TAGS } from '@/lib/reader/highlights-dom'
import { CATALOG_PATH } from '@/lib/nav'
import { useReaderPreferences, READER_FONTS, READER_THEMES, READER_FONT_SIZE_MIN, READER_FONT_SIZE_MAX } from '@/lib/reader/reader-preferences'
import type { ReaderThemeId } from '@/lib/reader/reader-preferences'

interface ReleaseBookReaderProps {
  release: Release
  edition: Edition
  chapters: Chapter[]
  currentUserId: string | null
  initialHighlights: ChapterHighlight[]
  userRole: UserRole | null
  userName: string | null
  initialChapterIndex?: number
  otherBookEditions?: Edition[]
}

interface SelectionData {
  text: string
  rect: DOMRect
  paragraphIndex: number
  contextBefore: string
  contextAfter: string
  startOffset: number
  endOffset: number
}

export function ReleaseBookReader({
  release,
  edition,
  chapters,
  currentUserId,
  initialHighlights,
  userRole,
  initialChapterIndex = 0,
  otherBookEditions = [],
}: ReleaseBookReaderProps) {
  const accent = release.design_config?.accent_color ?? '#d52525'
  const isEditor = userRole === 'editor' || userRole === 'admin'

  const {
    theme,
    font,
    fontSize,
    t,
    fontFamily,
    applyTheme,
    applyFont,
    applyFontSize,
  } = useReaderPreferences()
  const bg = t.bg
  const textColor = t.text

  const [currentIndex, setCurrentIndex] = useState(initialChapterIndex)
  const [showToc, setShowToc] = useState(false)
  const [showThemes, setShowThemes] = useState(false)
  const [showFonts, setShowFonts] = useState(false)
  const [highlights, setHighlights] = useState<ChapterHighlight[]>(initialHighlights)
  const [selection, setSelection] = useState<SelectionData | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<ChapterHighlight | null>(null)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [artifactOpen, setArtifactOpen] = useState(false)
  const [artifactRect, setArtifactRect] = useState<DOMRect | null>(null)
  const [pendingScroll, setPendingScroll] = useState<{ paragraphIndex: number; chapterId: string } | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const floatingMenuRef = useRef<HTMLDivElement>(null)

  const currentChapter = chapters[currentIndex]
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count ?? 0), 0)
  const readingMinutes = Math.ceil(totalWords / 200)
  const progress = chapters.length > 1 ? (currentIndex / (chapters.length - 1)) * 100 : 100

  // Highlights текущей главы
  const chapterHighlights = useMemo(
    () => highlights.filter(h => h.chapter_id === currentChapter?.id),
    [highlights, currentChapter],
  )

  // Editorial notes текущей главы (загрузка/мутации — в общем хуке)
  const {
    chapterNotes: chapterEditorialNotes,
    activeNote: activeEditorialNote,
    setActiveNote: setActiveEditorialNote,
    createNote: createEditorialNote,
    updateStatus: updateEditorialNoteStatus,
    deleteNote: deleteEditorialNote,
  } = useEditorialNotes({ chapterId: currentChapter?.id, enabled: isEditor })

  // Мои хайлайты (все главы, отсортированные по позиции)
  const myHighlights = useMemo(
    () => currentUserId
      ? highlights
          .filter(h => h.user_id === currentUserId)
          .sort((a, b) => (a.paragraph_index ?? 0) - (b.paragraph_index ?? 0))
      : [],
    [highlights, currentUserId],
  )

  // Подгружаем highlights при смене главы
  useEffect(() => {
    if (!currentChapter) return
    if (highlights.some(h => h.chapter_id === currentChapter.id)) return
    let cancelled = false
    const controller = new AbortController()
    fetch(`/api/chapter-highlights?chapterId=${currentChapter.id}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.data) return
        setHighlights(prev => {
          const ids = new Set(prev.map(h => h.id))
          return [...prev, ...data.data.filter((h: ChapterHighlight) => !ids.has(h.id))]
        })
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error('Не удалось загрузить цитаты главы')
      })
    return () => { cancelled = true; controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlights refetch only on chapter change
  }, [currentChapter?.id])

  // Применяем подсветки к DOM после рендера
  useEffect(() => {
    const root = contentRef.current
    if (!root || !currentChapter) return

    let cancelled = false

    // Снимаем старые подсветки (highlights + editorial notes)
    clearHighlightMarks(root)

    // Собираем параграфы в порядке DOM
    const paragraphs = collectParagraphs(root)
    if (cancelled) return

    // Группируем highlights по параграфу
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

    // Группируем editorial notes по параграфу (editor/admin only)
    if (isEditor && chapterEditorialNotes.length > 0) {
      const enByParagraph = new Map<number, ChapterEditorialNote[]>()
      for (const en of chapterEditorialNotes) {
        if (en.paragraph_index == null) continue
        const arr = enByParagraph.get(en.paragraph_index) ?? []
        arr.push(en)
        enByParagraph.set(en.paragraph_index, arr)
      }

      paragraphs.forEach((p, idx) => {
        const list = enByParagraph.get(idx)
        if (!list) return
        for (const en of list) wrapEditorialNote(p, en)
      })
    }

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- DOM highlight sync, avoids re-render loop
  }, [currentChapter?.id, chapterHighlights, chapterEditorialNotes, currentIndex, isEditor])

  // Сохраняем прогресс чтения на сервере (только для залогиненных).
  // Debounce 1.5с, чтобы не спамить при быстром перелистывании.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saves on chapter+progress change, not on full object
  }, [currentUserId, currentChapter?.id, edition.id, progress])

  // Скролл наверх + синхронизация URL при смене главы. Название главы уходит в
  // адрес скролл-читалки; setState в effect — reset selection/artifact навигацией.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const editionSlug = edition.slug || edition.id
    window.history.replaceState(null, '', `/vvvvv/${editionSlug}`)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection/artifact on chapter navigation
    setSelection(null)
    setArtifactOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL sync on chapter index only
  }, [currentIndex, edition.slug])

  // Клавиатура
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' && currentIndex < chapters.length - 1) setCurrentIndex(i => i + 1)
      if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(i => i - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIndex, chapters.length])

  // Клик по подсвеченному highlight/editorial note — открываем попап
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName !== 'MARK') return
      if (target.dataset.cfHl) {
        const hlId = target.dataset.cfHl
        const hl = chapterHighlights.find(h => h.id === hlId)
        if (hl) setActiveHighlight(hl)
      } else if (target.dataset.cfEn) {
        const enId = target.dataset.cfEn
        const en = chapterEditorialNotes.find(n => n.id === enId)
        if (en) setActiveEditorialNote(en)
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [chapterHighlights, chapterEditorialNotes, setActiveEditorialNote])

  const handleMouseUp = useCallback(() => {
    if (!currentUserId) return
    if (floatingMenuRef.current?.contains(document.activeElement)) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const text = sel.toString().trim()
    if (text.length < 3) {
      setSelection(null)
      return
    }
    if (!contentRef.current?.contains(sel.anchorNode)) return

    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Находим индекс параграфа
    let node: Node | null = sel.anchorNode
    let paragraphIndex = -1
    let paragraphEl: HTMLElement | null = null
    while (node && node !== contentRef.current) {
      if (node instanceof HTMLElement) {
        const tag = node.tagName.toLowerCase()
        if (PARAGRAPH_TAGS.includes(tag)) {
          paragraphEl = node
          break
        }
      }
      node = node.parentNode
    }

    if (paragraphEl) {
      const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
          if (!(n instanceof HTMLElement)) return NodeFilter.FILTER_REJECT
          const t = n.tagName.toLowerCase()
          if (PARAGRAPH_TAGS.includes(t)) {
            return NodeFilter.FILTER_ACCEPT
          }
          return NodeFilter.FILTER_SKIP
        },
      })
      let i = 0
      let n: Node | null = walker.nextNode()
      while (n) {
        if (n === paragraphEl) { paragraphIndex = i; break }
        i++
        n = walker.nextNode()
      }
    }

    const fullText = paragraphEl?.textContent ?? ''
    const offset = fullText.indexOf(text)
    const contextBefore = offset >= 0 ? fullText.slice(Math.max(0, offset - 30), offset) : ''
    const contextAfter = offset >= 0 ? fullText.slice(offset + text.length, offset + text.length + 30) : ''

    setSelection({ text, rect, paragraphIndex, contextBefore, contextAfter, startOffset: Math.max(0, offset), endOffset: Math.max(0, offset) + text.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentUserId checked inside, stable callback
  }, [])

  // На touch-устройствах Selection обновляется после pointerup. Один кадр
  // ожидания позволяет прочитать уже финальный Range и не ломает mouse-flow.
  const handleSelectionEnd = useCallback(() => {
    window.setTimeout(handleMouseUp, 0)
  }, [handleMouseUp])

  const scrollToParagraph = useCallback((paragraphIndex: number) => {
    const root = contentRef.current
    if (!root) return
    const paragraphs = root.querySelectorAll('p')
    const el = paragraphs[paragraphIndex] as HTMLElement | undefined
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('cf-scroll-flash')
    setTimeout(() => el.classList.remove('cf-scroll-flash'), 1800)
  }, [])

  // Навигация к хайлайту — умеет переключать главы
  const scrollToHighlight = useCallback((paragraphIndex: number, chapterId: string) => {
    const targetIndex = chapters.findIndex(ch => ch.id === chapterId)
    if (targetIndex === -1) return
    if (targetIndex === currentIndex) {
      scrollToParagraph(paragraphIndex)
    } else {
      setPendingScroll({ paragraphIndex, chapterId })
      setCurrentIndex(targetIndex)
      setShowBookmarks(false)
    }
  }, [chapters, currentIndex, scrollToParagraph])

  // Срабатывает после смены главы — скроллит к нужному параграфу
  useEffect(() => {
    if (!pendingScroll) return
    if (currentChapter?.id !== pendingScroll.chapterId) return
    const timer = setTimeout(() => {
      scrollToParagraph(pendingScroll.paragraphIndex)
      setPendingScroll(null)
    }, 350)
    return () => clearTimeout(timer)
  }, [currentChapter?.id, pendingScroll, scrollToParagraph])

  const deleteHighlight = useCallback(async (id: string) => {
    const res = await fetch(`/api/chapter-highlights/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setHighlights(prev => prev.filter(h => h.id !== id))
    }
  }, [])

  const updateHighlight = useCallback(
    async (id: string, patch: { note?: string | null; is_public?: boolean }) => {
      const res = await fetch(`/api/chapter-highlights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.data) {
        toast.error(data?.error ?? 'Не удалось обновить цитату')
        return
      }
      const updated = data.data as ChapterHighlight
      setHighlights(prev => prev.map(h => (h.id === id ? updated : h)))
      setActiveHighlight(prev => (prev?.id === id ? updated : prev))
    },
    [],
  )

  const saveEditorialFromArtifact = async (noteText: string) => {
    if (!selection || !currentChapter) return
    const ok = await createEditorialNote(selection, noteText)
    if (ok) {
      setSelection(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  const toggleLike = async (id: string) => {
    if (!currentUserId) {
      toast.error('Войдите чтобы ставить лайки')
      return
    }
    const target = highlights.find(h => h.id === id)
    if (!target) return
    const res = await fetch(`/api/chapter-highlights/${id}/like`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liked: !target.is_liked_by_me }),
    })
    if (res.ok) {
      const data = await res.json()
      setHighlights(prev => prev.map(h =>
        h.id === id ? { ...h, is_liked_by_me: data.data.liked, likes_count: data.data.likes_count } : h,
      ))
      if (activeHighlight?.id === id) {
        setActiveHighlight(prev => prev ? { ...prev, is_liked_by_me: data.data.liked, likes_count: data.data.likes_count } : null)
      }
    } else {
      toast.error('Не удалось обновить лайк')
    }
  }

  if (chapters.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cf-bg">
        <p className="text-cf-text-4 text-sm">Содержимое ещё не опубликовано</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, color: textColor }}>
      {/* Прогресс-бар */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5" style={{ backgroundColor: `${accent}22` }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: accent }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0.5 z-40 border-b backdrop-blur-xl"
        style={{ borderColor: `${textColor}12`, backgroundColor: `${bg}ee` }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 md:px-8">
          <Link
            href={`/release/${release.slug}`}
            className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: textColor }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline truncate max-w-[160px]">{release.title}</span>
          </Link>

          <div className="relative flex items-center gap-1">
            <button
              onClick={() => applyFontSize(Math.max(READER_FONT_SIZE_MIN, fontSize - 2))}
              className="px-2 py-1.5 text-xs font-black transition-opacity hover:opacity-60"
              style={{ color: textColor }}
              aria-label="Уменьшить шрифт"
            >
              A-
            </button>
            <button
              onClick={() => applyFontSize(Math.min(READER_FONT_SIZE_MAX, fontSize + 2))}
              className="px-2 py-1.5 text-sm font-black transition-opacity hover:opacity-60"
              style={{ color: textColor }}
              aria-label="Увеличить шрифт"
            >
              A+
            </button>
            <button
              onClick={() => { setShowFonts(b => !b); setShowThemes(false) }}
              className="ml-1 p-2 transition-opacity hover:opacity-60"
              style={{ color: showFonts ? accent : textColor }}
              aria-label="Шрифт и размер"
            >
              <Type className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setShowThemes(b => !b); setShowFonts(false) }}
              className="ml-1 p-2 transition-opacity hover:opacity-60"
              style={{ color: showThemes ? accent : textColor }}
              aria-label="Тема чтения"
            >
              {theme === 'void' ? <Moon className="h-4 w-4" /> : theme === 'manuscript' ? <Sun className="h-4 w-4" /> : <Palette className="h-4 w-4" />}
            </button>

            {showThemes && (
              <div
                className="absolute right-0 top-full z-20 mt-2 flex w-44 flex-col gap-1 p-2"
                style={{ backgroundColor: bg, border: `1px solid ${textColor}2f` }}
              >
                {(Object.keys(READER_THEMES) as ReaderThemeId[]).map(th => {
                  const active = theme === th
                  return (
                    <button
                      key={th}
                      onClick={() => { applyTheme(th); setShowThemes(false) }}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs font-black uppercase tracking-[0.14em] transition-colors"
                      style={{
                        color: active ? accent : textColor,
                        border: `1px solid ${active ? accent : 'transparent'}`,
                      }}
                    >
                      <span
                        className="h-3 w-4 shrink-0"
                        style={{ backgroundColor: READER_THEMES[th].bg2, border: `1px solid ${textColor}40` }}
                      />
                      {READER_THEMES[th].label}
                    </button>
                  )
                })}
              </div>
            )}

            {showFonts && (
              <div
                className="absolute right-0 top-full z-20 mt-2 flex w-60 flex-col gap-1 p-2"
                style={{ backgroundColor: bg, border: `1px solid ${textColor}2f` }}
              >
                <div
                  className="mb-1 flex items-center justify-between px-1 pb-1.5"
                  style={{ borderBottom: `1px solid ${textColor}12` }}
                >
                  <button
                    onClick={() => applyFontSize(Math.max(READER_FONT_SIZE_MIN, fontSize - 2))}
                    className="px-2 py-0.5 text-xs font-black transition-opacity hover:opacity-60"
                    aria-label="Уменьшить"
                  >
                    A−
                  </button>
                  <span className="text-xs tabular-nums">{fontSize}px</span>
                  <button
                    onClick={() => applyFontSize(Math.min(READER_FONT_SIZE_MAX, fontSize + 2))}
                    className="px-2 py-0.5 text-sm font-black transition-opacity hover:opacity-60"
                    aria-label="Увеличить"
                  >
                    A+
                  </button>
                </div>
                {READER_FONTS.map(fn => {
                  const active = font === fn.id
                  return (
                    <button
                      key={fn.id}
                      onClick={() => { applyFont(fn.id); setShowFonts(false) }}
                      className="flex w-full items-baseline justify-between gap-2 px-2 py-1.5 text-left transition-colors"
                      style={{ color: active ? accent : textColor }}
                    >
                      <span style={{ fontFamily: fn.family }}>{fn.label}</span>
                      <span className="text-[10px] opacity-40">{fn.sample}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {chapters.length > 1 && (
              <button
                onClick={() => setShowToc(true)}
                className="ml-1 p-2 transition-opacity hover:opacity-60"
                style={{ color: textColor }}
                aria-label="Оглавление"
              >
                <AlignJustify className="h-4 w-4" />
              </button>
            )}
            {currentUserId && (
              <button
                onClick={() => setShowBookmarks(b => !b)}
                className="relative ml-1 p-2 transition-opacity hover:opacity-60"
                style={{ color: showBookmarks ? accent : textColor }}
                aria-label="Мои закладки"
              >
                <Bookmark className="h-4 w-4" style={{ fill: myHighlights.length > 0 ? 'currentColor' : 'none' }} />
                {myHighlights.length > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black leading-none"
                    style={{ backgroundColor: accent, color: '#fff' }}
                  >
                    {myHighlights.length > 9 ? '9+' : myHighlights.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8 md:py-16">
        <div className="mb-10">
          {chapters.length > 1 && (
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em]" style={{ color: accent }}>
              {currentIndex === 0 && release.genre ? release.genre : `Глава ${currentIndex + 1}`}
            </p>
          )}
          <h1 className="text-3xl font-black uppercase leading-none md:text-4xl" style={{ color: textColor }}>
            {currentChapter.title}
          </h1>
          {currentIndex === 0 && release.annotation && (
            <p className="mt-5 text-base leading-7 opacity-60" style={{ color: textColor }}>
              {release.annotation}
            </p>
          )}
          {currentIndex === 0 && (
            <div className="mt-4 flex items-center gap-4">
              {release.authors.length > 0 && (
                <span className="text-xs opacity-50" style={{ color: textColor }}>
                  {release.authors.map(a => a.name).join(', ')}
                </span>
              )}
              {totalWords > 0 && (
                <span className="text-xs opacity-40" style={{ color: textColor }}>
                  ~{readingMinutes} мин чтения
                </span>
              )}
            </div>
          )}
          <div className="mt-8 h-px w-16 opacity-20" style={{ backgroundColor: textColor }} />
        </div>

        {/* Текст главы */}
        {currentChapter.content ? (
          <div
            ref={contentRef}
            onPointerUp={handleSelectionEnd}
            className="prose max-w-none leading-8 prose-p:mb-5"
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              color: textColor,
              ['--tw-prose-body' as string]: textColor,
              ['--tw-prose-headings' as string]: textColor,
              ['--tw-prose-links' as string]: accent,
              ['--tw-prose-bold' as string]: textColor,
              ['--tw-prose-quotes' as string]: textColor,
              ['--tw-prose-hr' as string]: `${textColor}20`,
            }}
            dangerouslySetInnerHTML={{ __html: currentChapter.content ?? '' }}
          />
        ) : (
          <p className="opacity-40 py-16 text-center text-sm" style={{ color: textColor }}>
            Содержимое главы ещё не добавлено
          </p>
        )}

        {/* Навигация prev/next */}
        <div className="mt-20 flex items-stretch gap-3">
          {currentIndex > 0 ? (
            <button
              onClick={() => setCurrentIndex(i => i - 1)}
              className="group flex flex-1 items-center gap-3 border py-4 px-5 text-left transition-colors"
              style={{ borderColor: `${textColor}14` }}
            >
              <ChevronLeft className="h-4 w-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: textColor }} />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] opacity-40 mb-1" style={{ color: textColor }}>Назад</p>
                <p className="truncate text-sm font-bold" style={{ color: textColor }}>{chapters[currentIndex - 1].title}</p>
              </div>
            </button>
          ) : <div className="flex-1" />}

          {currentIndex < chapters.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(i => i + 1)}
              className="group flex flex-1 items-center justify-end gap-3 border py-4 px-5 text-right transition-colors"
              style={{ borderColor: `${textColor}14` }}
            >
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] opacity-40 mb-1" style={{ color: textColor }}>Далее</p>
                <p className="truncate text-sm font-bold" style={{ color: textColor }}>{chapters[currentIndex + 1].title}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: textColor }} />
            </button>
          ) : (
            <div className="flex flex-1 flex-col items-end justify-center gap-2 border py-4 px-5" style={{ borderColor: `${textColor}14` }}>
              <p className="text-[10px] uppercase tracking-[0.16em] opacity-40" style={{ color: textColor }}>Конец</p>
              <Link
                href={CATALOG_PATH}
                className="text-sm font-black uppercase tracking-[0.12em] transition-opacity hover:opacity-70"
                style={{ color: accent }}
              >
                Все релизы →
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* === PHASE 1: Pill toolbar above selection === */}
      {selection && !artifactOpen && (
        <div
          ref={floatingMenuRef}
          className="fixed z-[100] flex items-center overflow-hidden shadow-2xl max-sm:inset-x-4 max-sm:bottom-4 max-sm:justify-between max-sm:rounded-lg sm:rounded-full sm:top-[var(--selection-top)] sm:left-[var(--selection-left)]"
          style={{
            '--selection-top': `${Math.max(60, selection.rect.top - 52)}px`,
            '--selection-left': `${Math.max(8, Math.min(window.innerWidth - 200, selection.rect.left + selection.rect.width / 2 - 96))}px`,
            backgroundColor: '#0e0d0c',
            border: '1px solid rgba(244,239,229,0.12)',
          } as React.CSSProperties}
          onMouseDown={e => e.preventDefault()}
        >
          {/* Метка цитаты */}
          <span
            className="max-w-[42vw] truncate pl-4 pr-2 font-[family-name:var(--font-cormorant)] text-[13px] italic opacity-50 select-none sm:max-w-[180px]"
            style={{ color: '#f4efe5' }}
          >
            {selection.text.length > 28 ? selection.text.slice(0, 28) + '…' : selection.text}
          </span>

          <span className="h-5 w-px" style={{ backgroundColor: 'rgba(244,239,229,0.12)' }} />

          {/* Открыть артефакт */}
          <button
            onClick={() => { setArtifactRect(selection.rect); setArtifactOpen(true) }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors hover:bg-white/5"
            style={{ color: accent }}
            title="Артефакт"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>С фрагментом</span>
          </button>

          {/* Закрыть */}
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

      {/* === Артефакт-карточка === */}
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
          startOffset={selection.startOffset}
          endOffset={selection.endOffset}
          currentUserId={currentUserId}
          onSaved={hl => {
            setHighlights(prev => [hl, ...prev])
            window.getSelection()?.removeAllRanges()
            // Карточка сама переходит в фазу инструментов — не закрываем
          }}
          onClose={() => {
            setArtifactOpen(false)
            setSelection(null)
            window.getSelection()?.removeAllRanges()
          }}
          accent={accent}
          bg={bg}
          textColor={textColor}
          isEditor={isEditor}
          onSaveEditorial={saveEditorialFromArtifact}
        />
      )}

      {/* Highlight detail popup */}
      {activeHighlight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveHighlight(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-w-md w-full border p-6 shadow-2xl"
            style={{ backgroundColor: bg, borderColor: `${textColor}18`, color: textColor }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveHighlight(null)}
              className="absolute top-3 right-3 p-1 opacity-40 hover:opacity-100"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              {activeHighlight.user_avatar ? (
                <div className="relative h-10 w-10">
                  <Image src={activeHighlight.user_avatar} alt={activeHighlight.user_name ?? ''} fill sizes="40px" className="rounded-full object-cover" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accent}33`, color: accent }}>
                  <span className="font-black text-sm">{(activeHighlight.user_name ?? '?')[0]}</span>
                </div>
              )}
              <div>
                <p className="font-bold text-sm">{activeHighlight.user_name ?? 'Аноним'}</p>
                <p className="text-[10px] opacity-50">
                  {new Date(activeHighlight.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <blockquote
              className="text-sm leading-relaxed italic border-l-2 pl-3 opacity-80"
              style={{ borderColor: accent }}
            >
              «{activeHighlight.text_content}»
            </blockquote>

            {activeHighlight.note && (
              <p className="mt-4 text-sm leading-relaxed">{activeHighlight.note}</p>
            )}

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                onClick={() => toggleLike(activeHighlight.id)}
                className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity"
              >
                <Heart
                  className="h-3.5 w-3.5"
                  style={activeHighlight.is_liked_by_me ? { fill: accent, color: accent } : undefined}
                />
                <span>{activeHighlight.likes_count}</span>
              </button>

              <Link
                href={`/highlight/${activeHighlight.id}`}
                className="text-[10px] uppercase tracking-[0.16em] opacity-50 hover:opacity-100"
                style={{ color: accent }}
              >
                Поделиться
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Editorial note detail popup */}
      {activeEditorialNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveEditorialNote(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-w-md w-full border p-6 shadow-2xl"
            style={{ backgroundColor: bg, borderColor: '#e9731640', color: textColor }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveEditorialNote(null)}
              className="absolute top-3 right-3 p-1 opacity-40 hover:opacity-100"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4" style={{ color: '#e97316' }} />
              <span className="text-[10px] uppercase tracking-[0.16em] font-black" style={{ color: '#e97316' }}>
                {activeEditorialNote.status === 'open' ? 'Открытое замечание' :
                 activeEditorialNote.status === 'resolved' ? 'Решённое замечание' :
                 'Проигнорированное замечание'}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              {activeEditorialNote.author_avatar ? (
                <div className="relative h-10 w-10">
                  <Image src={activeEditorialNote.author_avatar} alt={activeEditorialNote.author_name ?? ''} fill sizes="40px" className="rounded-full object-cover" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e9731633', color: '#e97316' }}>
                  <span className="font-black text-sm">{(activeEditorialNote.author_name ?? '?')[0]}</span>
                </div>
              )}
              <div>
                <p className="font-bold text-sm">{activeEditorialNote.author_name ?? 'Редактор'}</p>
                <p className="text-[10px] opacity-50">
                  {new Date(activeEditorialNote.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <blockquote
              className="text-sm leading-relaxed italic border-l-2 pl-3 opacity-80"
              style={{ borderColor: '#e97316' }}
            >
              «{activeEditorialNote.text_content}»
            </blockquote>

            <p className="mt-4 text-sm leading-relaxed">{activeEditorialNote.note}</p>

            {isEditor && (
              <div className="mt-5 flex gap-2">
                {activeEditorialNote.status === 'open' ? (
                  <>
                    <button
                      onClick={() => updateEditorialNoteStatus(activeEditorialNote.id, 'resolved')}
                      className="flex-1 h-8 text-xs font-black uppercase tracking-[0.1em] flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: '#16a34a', color: bg }}
                    >
                      <Check className="h-3 w-3" /> Решено
                    </button>
                    <button
                      onClick={() => updateEditorialNoteStatus(activeEditorialNote.id, 'ignored')}
                      className="flex-1 h-8 text-xs border transition-opacity hover:opacity-60"
                      style={{ borderColor: `${textColor}20` }}
                    >
                      Игнорировать
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => updateEditorialNoteStatus(activeEditorialNote.id, 'open')}
                    className="flex-1 h-8 text-xs border transition-opacity hover:opacity-60"
                    style={{ borderColor: `${textColor}20` }}
                  >
                    Вернуть в работу
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!confirm('Удалить замечание?')) return
                    deleteEditorialNote(activeEditorialNote.id)
                  }}
                  className="h-8 w-8 shrink-0 border flex items-center justify-center transition-opacity hover:opacity-60"
                  style={{ borderColor: `${textColor}20` }}
                  aria-label="Удалить замечание"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Оглавление */}
      {showToc && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowToc(false)} />
          <aside
            className="flex w-72 flex-col border-l"
            style={{ backgroundColor: bg, borderColor: `${textColor}12` }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-4"
              style={{ borderColor: `${textColor}12` }}
            >
              <h2 className="text-sm font-black uppercase tracking-[0.14em]" style={{ color: textColor }}>
                Оглавление
              </h2>
              <button
                onClick={() => setShowToc(false)}
                className="p-1 opacity-40 hover:opacity-100 transition-opacity"
                style={{ color: textColor }}
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => { setCurrentIndex(i); setShowToc(false) }}
                  className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors"
                  style={{
                    borderColor: `${textColor}08`,
                    backgroundColor: i === currentIndex ? `${accent}10` : 'transparent',
                  }}
                >
                  <span
                    className="mt-0.5 min-w-[20px] text-xs font-black tabular-nums"
                    style={{ color: i === currentIndex ? accent : `${textColor}40` }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p
                      className="text-sm leading-snug"
                      style={{
                        color: i === currentIndex ? textColor : `${textColor}70`,
                        fontWeight: i === currentIndex ? 700 : 400,
                      }}
                    >
                      {ch.title}
                    </p>
                    {ch.word_count > 0 && (
                      <p className="mt-0.5 text-[10px] opacity-30" style={{ color: textColor }}>
                        {ch.word_count.toLocaleString('ru-RU')} слов
                      </p>
                    )}
                  </div>
                </button>
              ))}
              <Link
                href={`/release/${release.slug}`}
                onClick={() => setShowToc(false)}
                className="flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.1em] transition-opacity hover:opacity-80"
                style={{ color: accent, borderColor: `${textColor}08` }}
              >
                <List className="h-4 w-4" />
                Страница релиза
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Bookmarks panel */}
      {currentUserId && (
        <BookmarksPanel
          open={showBookmarks}
          onClose={() => setShowBookmarks(false)}
          highlights={myHighlights}
          currentChapterId={currentChapter?.id ?? ''}
          onDelete={deleteHighlight}
          onUpdate={updateHighlight}
          onScrollTo={scrollToHighlight}
          accent={accent}
          bg={bg}
          textColor={textColor}
        />
      )}

      {/* Cross-linking to other editions */}
      {otherBookEditions && otherBookEditions.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t py-3"
          style={{
            backgroundColor: bg,
            borderColor: `${textColor}15`,
          }}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-4 px-6">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] opacity-40">
              Также доступно:
            </span>
            <div className="flex gap-2">
              {otherBookEditions.map(other => (
                <Link
                  key={other.id}
                  href={`/vvvvv/${other.slug || other.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:border-current"
                  style={{
                    borderColor: `${textColor}20`,
                    color: other.quality_tier === edition.quality_tier ? accent : textColor,
                    backgroundColor: other.quality_tier === edition.quality_tier ? `${accent}15` : 'transparent',
                  }}
                >
                  {getEditionLabel(other)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
