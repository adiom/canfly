'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, AlignJustify, Bookmark, BookmarkPlus, Heart, ChevronLeft, Sun, Moon, Palette, MessageCircle, Check, Trash2, Type } from 'lucide-react'
import { toast } from 'sonner'
import { useSpreadPagination } from '@/lib/reader/use-spread-pagination'
import { useEditorialNotes } from '@/lib/reader/use-editorial-notes'
import {
  collectParagraphs,
  clearHighlightMarks,
  wrapHighlight,
  wrapEditorialNote,
  pageOfElement,
  findTextRange,
  PARAGRAPH_TAGS,
} from '@/lib/reader/highlights-dom'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { HighlightArtifact } from '@/components/highlight-artifact'
import { useReaderPreferences, READER_THEMES, READER_FONTS } from '@/lib/reader/reader-preferences'
import type { ReaderThemeId } from '@/lib/reader/reader-preferences'
import type { Release, Edition, Chapter, ChapterHighlight, ChapterEditorialNote } from '@/lib/releases-types'
import type { UserRole } from '@/lib/types'

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface SelectionData {
  text: string
  rect: DOMRect
  paragraphIndex: number
  contextBefore: string
  contextAfter: string
  startOffset: number
  endOffset: number
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
  const isEditor = userRole === 'editor' || userRole === 'admin'

  const {
    mounted,
    theme,
    font,
    fontSize,
    t,
    fontFamily,
    applyTheme,
    applyFont,
    applyFontSize,
  } = useReaderPreferences()

  // Максимально допустимый translateX трека — чтобы на последней странице
  // не торчал обрезок соседней колонки через overflow:hidden.
  const [maxTranslate, setMaxTranslate] = useState(0)
  // Ширина кликабельной полосы листания по каждому краю viewport.
  const [sideGutter, setSideGutter] = useState(28)

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
  const [showFonts, setShowFonts] = useState(false)

  // Навигация к закладке из другой главы
  const [pendingHighlightNav, setPendingHighlightNav] = useState<{ paragraphIndex: number; chapterId: string } | null>(null)
  // При переходе назад — хотим открыть последнюю страницу главы
  const [pendingLastPage, setPendingLastPage] = useState(false)

  // Refs
  const stageRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const floatingMenuRef = useRef<HTMLDivElement>(null)

  // Пагинация книжного разворота (используется для currentPage / pageCount
  // в эффектах навигации к хайлайтам; CSS-разметка больше не зависит от pageWidth).
  const pagination = useSpreadPagination(viewportRef, trackRef, fontSize, currentChapter?.id ?? '')
  const {
    pageCount,
    currentPage,
    isSpread,
    pageWidth,
    gutter,
    setCurrentPage,
    remeasure,
  } = pagination

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
  }, [currentChapter?.id, remeasure, mounted])

  // Вычисленные
  const pagesPerView = isSpread ? 2 : 1
  const maxPage = Math.max(0, pageCount - pagesPerView)

  // Пересчёт максимального сдвига трека и ширины полей листания. Двойной
  // rAF, чтобы колонки гарантированно отрендерились с актуальной геометрией
  // после remeasure.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      const track = trackRef.current
      const vp = viewportRef.current
      const stage = stageRef.current
      if (!track || !vp || !stage) return
      // viewport теперь совпадает со страницей (поля живут на stage), поэтому
      // clientWidth — чистая ширина страницы.
      const next = Math.max(0, track.scrollWidth - vp.clientWidth)
      setMaxTranslate(prev => (Math.abs(prev - next) > 0.5 ? next : prev))
      // Полоса листания = поле страницы плюс пустое место от края окна до
      // stage (окно шире maxWidth). Минимум 28px под палец.
      const padLeft = parseFloat(getComputedStyle(stage).paddingLeft)
      const g = Math.max(28, Math.floor(stage.getBoundingClientRect().left + padLeft))
      setSideGutter(prev => (prev !== g ? g : prev))
    }))
    return () => cancelAnimationFrame(id)
  }, [currentChapter?.id, fontSize, pageCount, pagination.spreadWidth, currentPage, mounted])

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

  // Редакторские правки текущей главы (editor/admin)
  const {
    chapterNotes: chapterEditorialNotes,
    activeNote: activeEditorialNote,
    setActiveNote: setActiveEditorialNote,
    createNote: createEditorialNote,
    updateStatus: updateEditorialNoteStatus,
    deleteNote: deleteEditorialNote,
  } = useEditorialNotes({ chapterId: currentChapter?.id, enabled: isEditor })

  // Прогресс
  const intraChapter = pageCount > 1 ? currentPage / (pageCount - 1) : 1
  const progress = Math.round(((currentIndex + intraChapter) / chapters.length) * 100)

  // ── Загрузка хайлайтов при смене главы ──
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

    // Редакторские правки поверх — только для команды
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- DOM highlight sync, avoids re-render loop
  }, [currentChapter?.id, chapterHighlights, chapterEditorialNotes, currentIndex, accent, currentUserId, isEditor, mounted])

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
      } else if (target.dataset.cfEn) {
        const en = chapterEditorialNotes.find(n => n.id === target.dataset.cfEn)
        if (en) setActiveEditorialNote(en)
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
    // mounted: до гидрации contentRef пуст, без него подписка не встала бы
  }, [chapterHighlights, chapterEditorialNotes, setActiveEditorialNote, mounted])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saves on chapter+progress change, not on full object
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

  // ── Тап и свайп на mobile ──
  // Один обработчик на «стол»: тап по боковой четверти листает, свайп листает
  // с любой точки страницы. Текст остаётся зоной выделения — центральные 44%
  // на тап не реагируют, а активное выделение и цитаты отменяют жест целиком.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let startX = 0
    let startY = 0
    let startedAt = 0
    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startedAt = performance.now()
    }
    const onTouchEnd = (e: TouchEvent) => {
      // Выделение (или тап по нему) не должно листать: pointerup уже отдал
      // фрагмент в пилюлю, а страница ушла бы из-под него.
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return
      // Тап по цитате открывает попап — это делает слушатель на contentRef.
      if (e.target instanceof HTMLElement && e.target.closest('mark[data-cf-hl], mark[data-cf-en]')) return

      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const elapsed = performance.now() - startedAt

      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const rect = stage.getBoundingClientRect()
        const ratio = (touch.clientX - rect.left) / rect.width
        if (ratio < 0.28) goPrev()
        else if (ratio > 0.72) goNext()
        return
      }

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && elapsed < 600) {
        if (dx < 0) goNext()
        else goPrev()
      }
    }
    stage.addEventListener('touchstart', onTouchStart, { passive: true })
    stage.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      stage.removeEventListener('touchstart', onTouchStart)
      stage.removeEventListener('touchend', onTouchEnd)
    }
    // mounted в deps: до гидрации разметки со «столом» ещё нет, и без него
    // подписка не встала бы после появления узла.
  }, [goNext, goPrev, mounted])

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

    setSelection({ text, rect, paragraphIndex, contextBefore, contextAfter, startOffset: Math.max(0, offset), endOffset: Math.max(0, offset) + text.length })
  }, [currentUserId])

  // Mobile WebKit фиксирует финальный Range после pointerup, поэтому читаем
  // Selection в следующей задаче очереди.
  const handleSelectionEnd = useCallback(() => {
    window.setTimeout(handleMouseUp, 0)
  }, [handleMouseUp])

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

  const toggleLike = async (id: string) => {
    if (!currentUserId) { toast.error('Войдите чтобы ставить лайки'); return }
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

  // ── Пустое состояние ──
  if (chapters.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: t.bg }}>
        <p className="text-sm" style={{ color: t.text2 }}>Содержимое ещё не опубликовано</p>
      </div>
    )
  }

  // useSyncExternalStore отдаёт одинаковый default-снепшот на сервере и при
  // первом клиентском рендере — hydration mismatch не возникает.
  if (!mounted) {
    return (
      <div
        className="fixed inset-0"
        style={{ backgroundColor: READER_THEMES.void.bg }}
        aria-hidden
      />
    )
  }

  return (
    <div
      className="fixed inset-0"
      style={{ backgroundColor: t.bg, color: t.text, fontFamily, transition: 'background-color 0.4s, color 0.4s' }}
    >
      <div
        className="reader-container"
        style={{
          display: 'grid',
          gridTemplateRows: '50px 1fr 40px',
          // minmax(0, 1fr), а не неявная auto-колонка: без явной колонки её
          // ширину браузер считает по max-content детей (grid blowout) — на
          // узких экранах нерезолвимый maxWidth: '40%' у .book-title откатывался
          // к полной ширине заголовка, и вся сетка вылезала за экран.
          gridTemplateColumns: 'minmax(0, 1fr)',
          // dvh, а не vh: в мобильном Safari 100vh выше видимой области, и
          // футер с низом страницы уезжали под адресную строку.
          height: '100dvh',
          boxSizing: 'border-box',
          backgroundColor: t.bg,
          color: t.text,
          fontFamily,
          transition: 'background-color 0.4s, color 0.4s',
        }}
      >
        <header
          className="reader-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            fontSize: 13,
            color: t.text2,
            fontFamily: 'var(--font-geist-sans)',
            position: 'relative',
            // Grid-item по умолчанию не сжимается уже своего min-content —
            // без этого truncate у .book-title не мог схлопнуться до maxWidth.
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              href={`/release/${release.slug}`}
              title="К релизу"
              // Паддинг адаптивный, классом: на телефоне тач-зона 24px (padding:4)
              // слишком мала для пальца, на десктопе — норм для курсора.
              className="p-2.5 sm:p-1"
              style={{ color: t.text2, display: 'inline-flex' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>

          <span
            className="book-title truncate"
            style={{ maxWidth: '40%' }}
            title={`${release.title} — ${currentChapter?.title ?? ''}`}
          >
            <span style={{ opacity: 0.7 }}>{release.title}</span>
            {chapters.length > 1 && (
              <span style={{ opacity: 0.5 }}> · {currentChapter?.title}</span>
            )}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            {chapters.length > 1 && (
              <button
                type="button"
                onClick={() => setShowToc(true)}
                title="Оглавление"
                className="p-2.5 sm:p-1"
                style={{ color: t.text }}
              >
                <AlignJustify className="h-4 w-4" />
              </button>
            )}
            {currentUserId && (
              <button
                type="button"
                onClick={() => setShowBookmarks(b => !b)}
                title="Закладки"
                className="p-2.5 sm:p-1"
                style={{ color: showBookmarks ? accent : t.text }}
              >
                <Bookmark
                  className="h-4 w-4"
                  style={{ fill: myHighlights.length > 0 ? 'currentColor' : 'none' }}
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowFonts(b => !b); setShowThemes(false) }}
              title={`Шрифт и размер: ${READER_FONTS.find(f => f.id === font)?.label ?? 'Cormorant'} · ${fontSize}px`}
              className="p-2.5 sm:p-1"
              style={{ color: showFonts ? accent : t.text }}
            >
              <Type className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setShowThemes(b => !b); setShowFonts(false) }}
              title={`Тема: ${READER_THEMES[theme].label}`}
              className="p-2.5 sm:p-1"
              style={{ color: showThemes ? accent : t.text }}
            >
              {theme === 'void' ? <Moon className="h-4 w-4" /> : theme === 'manuscript' ? <Sun className="h-4 w-4" /> : <Palette className="h-4 w-4" />}
            </button>

            {showThemes && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: 8,
                  backgroundColor: t.bg,
                  border: `1px solid ${t.text}20`,
                  borderRadius: 4,
                  zIndex: 60,
                  minWidth: 160,
                }}
              >
                {(['void', 'manuscript', 'sepia'] as ReaderThemeId[]).map(th => {
                  const def = READER_THEMES[th]
                  const active = theme === th
                  return (
                    <button
                      key={th}
                      type="button"
                      onClick={() => { applyTheme(th); setShowThemes(false) }}
                      title={def.fullName}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: active ? accent : t.text2,
                        border: `1px solid ${active ? accent : 'transparent'}`,
                        background: 'transparent',
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 12,
                          backgroundColor: def.bg2,
                          border: `1px solid ${t.text}40`,
                        }}
                      />
                      {def.label}
                    </button>
                  )
                })}
              </div>
            )}

            {showFonts && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 8,
                  backgroundColor: t.bg,
                  border: `1px solid ${t.text}20`,
                  borderRadius: 4,
                  zIndex: 60,
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: t.text2,
                      fontFamily: 'var(--font-geist-sans)',
                    }}
                  >
                    Размер
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => applyFontSize(Math.max(14, fontSize - 2))}
                      title="Мельче"
                      style={{
                        color: t.text,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 800,
                        border: `1px solid ${t.text}25`,
                        borderRadius: 3,
                        background: 'transparent',
                      }}
                    >A−</button>
                    <span
                      style={{
                        fontSize: 11,
                        color: t.text2,
                        fontFamily: 'var(--font-geist-sans)',
                        minWidth: 24,
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {fontSize}
                    </span>
                    <button
                      type="button"
                      onClick={() => applyFontSize(Math.min(26, fontSize + 2))}
                      title="Крупнее"
                      style={{
                        color: t.text,
                        padding: '2px 8px',
                        fontSize: 13,
                        fontWeight: 800,
                        border: `1px solid ${t.text}25`,
                        borderRadius: 3,
                        background: 'transparent',
                      }}
                    >A+</button>
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: `${t.text}12` }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {READER_FONTS.map(fn => {
                    const active = font === fn.id
                    return (
                      <button
                        key={fn.id}
                        type="button"
                        onClick={() => { applyFont(fn.id); setShowFonts(false) }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 2,
                          padding: '8px 10px',
                          textAlign: 'left',
                          background: 'transparent',
                          borderLeft: `2px solid ${active ? accent : 'transparent'}`,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: active ? accent : t.text2,
                            fontFamily: 'var(--font-geist-sans)',
                          }}
                        >
                          {fn.label}
                        </span>
                        <span style={{ fontSize: 13, color: t.text, fontFamily: fn.family }}>
                          {fn.sample}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* «Стол»: поля книги живут здесь, а не в padding viewport — иначе
            overflow:hidden режет по padding-box, и в поле проглядывает край
            соседней страницы. Классы, не inline: inline перебил бы sm:. */}
        <main
          ref={stageRef}
          className="book-stage px-[22px] py-4 sm:px-10 sm:py-5"
          style={{
            width: '100%',
            maxWidth: 1200,
            margin: '0 auto',
            boxSizing: 'border-box',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            ref={viewportRef}
            className="book-viewport relative"
            style={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <div
              ref={trackRef}
              className="book-columns"
              style={{
                height: '100%',
                width: pagination.spreadWidth,
                columnCount: isSpread ? 2 : 1,
                // Шаг листания хук считает как pageWidth + gutter, поэтому
                // зазор между колонками обязан быть тем же gutter.
                columnGap: gutter,
                columnFill: 'auto',
                fontSize: `${fontSize}px`,
                lineHeight: 1.7,
                textAlign: 'justify',
                textJustify: 'inter-word',
                hyphens: 'auto',
                WebkitHyphens: 'auto',
                MozHyphens: 'auto',
                msHyphens: 'auto',
                transform: `translateX(-${currentPage >= maxPage ? Math.min(currentPage * (pagination.pageWidth + pagination.gutter), maxTranslate) : currentPage * (pagination.pageWidth + pagination.gutter)}px)`,
              }}
            >
              {chapters.length > 1 && (
                <p
                  style={{
                    columnSpan: 'all',
                    fontSize: '11px',
                    fontFamily: 'var(--font-geist-sans)',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    margin: '0 0 8px',
                    color: accent,
                    breakAfter: 'avoid',
                  }}
                >
                  {currentIndex === 0 && release.genre ? release.genre : ''}
                </p>
              )}
              <h1
                style={{
                  columnSpan: 'all',
                  fontFamily: 'var(--font-geist-sans)',
                  fontSize: '1.6em',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                  margin: '0 0 24px',
                  breakAfter: 'avoid',
                  textAlign: 'left',
                }}
              >
                {currentChapter?.title}
              </h1>

              {currentChapter?.content ? (
                <div
                  ref={contentRef}
                  onPointerUp={handleSelectionEnd}
                  lang="ru"
                  className="prose max-w-none cf-reader-content"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.7,
                    color: t.text,
                    fontFamily,
                    hyphens: 'auto',
                    WebkitHyphens: 'auto',
                    MozHyphens: 'auto',
                    msHyphens: 'auto',
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
                <p style={{ textAlign: 'center', opacity: 0.4 }}>Содержимое главы ещё не добавлено</p>
              )}
            </div>
          </div>
        </main>

        <footer
          className="reader-footer px-[22px] sm:px-10"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: t.text2,
            fontFamily: 'var(--font-geist-sans)',
            minWidth: 0,
          }}
        >
          <span style={{ opacity: 0.6 }}>
            {currentIndex === 0 && release.authors.length > 0
              ? release.authors.map(a => a.name).join(', ')
              : ''}
          </span>
          <span style={{ opacity: 0.55, display: 'flex', gap: 12 }}>
            {chapters.length > 1 && (
              <span>{`Глава ${currentIndex + 1} / ${chapters.length}`}</span>
            )}
            {/* Без номера страницы на телефоне не видно, что тап сработал. */}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {pagesPerView > 1 && Math.min(currentPage + 2, pageCount) > currentPage + 1
                ? `${currentPage + 1}–${Math.min(currentPage + 2, pageCount)} / ${pageCount}`
                : `${currentPage + 1} / ${pageCount}`}
            </span>
          </span>
        </footer>
      </div>

      {/* Полоски листания в полях — для курсора. На телефоне не нужны:
          там листает тап по боковой четверти страницы и свайп. */}
      <button
        type="button"
        aria-label="Предыдущая страница"
        onClick={goPrev}
        className="max-sm:hidden"
        style={{
          position: 'absolute',
          top: 70,
          bottom: 60,
          left: 0,
          width: `${sideGutter}px`,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          zIndex: 2,
          padding: 0,
        }}
      />
      <button
        type="button"
        aria-label="Следующая страница"
        onClick={goNext}
        className="max-sm:hidden"
        style={{
          position: 'absolute',
          top: 70,
          bottom: 60,
          right: 0,
          width: `${sideGutter}px`,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          zIndex: 2,
          padding: 0,
        }}
      />

      <style>{`
        .cf-reader-content p {
          margin: 0;
          text-indent: 1.5em;
        }
        .cf-reader-content p:first-child {
          text-indent: 0;
        }
      `}</style>

      {/* ── Floating selection pill ── */}
      {selection && !artifactOpen && (
        <div
          ref={floatingMenuRef}
          className="fixed z-[100] flex items-center overflow-hidden shadow-2xl max-sm:inset-x-4 max-sm:bottom-4 max-sm:justify-between max-sm:rounded-lg sm:rounded-full sm:top-[var(--selection-top)] sm:left-[var(--selection-left)]"
          style={{
            '--selection-top': `${Math.max(60, selection.rect.top - 52)}px`,
            '--selection-left': `${Math.max(8, Math.min(window.innerWidth - 220, selection.rect.left + selection.rect.width / 2 - 104))}px`,
            backgroundColor: '#0e0d0c',
            border: '1px solid rgba(244,239,229,0.12)',
          } as React.CSSProperties}
          onMouseDown={e => e.preventDefault()}
        >
          <span
            className="max-w-[42vw] truncate pl-4 pr-2 text-[12px] italic opacity-50 select-none sm:max-w-[180px]"
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
            <span>С фрагментом</span>
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
          startOffset={selection.startOffset}
          endOffset={selection.endOffset}
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
          isEditor={isEditor}
          onSaveEditorial={async noteText => {
            if (!selection) return
            const ok = await createEditorialNote(selection, noteText)
            if (ok) {
              setArtifactOpen(false)
              setSelection(null)
              window.getSelection()?.removeAllRanges()
            }
          }}
        />
      )}

      {/* ── Попап редакторской правки ── */}
      {activeEditorialNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveEditorialNote(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md border p-6 shadow-2xl"
            style={{ backgroundColor: t.bg2, borderColor: '#e9731640', color: t.text }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveEditorialNote(null)}
              className="absolute right-3 top-3 p-1 opacity-40 hover:opacity-100"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4" style={{ color: '#e97316' }} />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#e97316' }}>
                {activeEditorialNote.status === 'open' ? 'Открытое замечание'
                  : activeEditorialNote.status === 'resolved' ? 'Решённое замечание'
                  : 'Проигнорированное замечание'}
              </span>
            </div>

            <div className="mb-4 flex items-center gap-3">
              {activeEditorialNote.author_avatar ? (
                <div className="relative h-10 w-10">
                  <Image src={activeEditorialNote.author_avatar} alt={activeEditorialNote.author_name ?? ''} fill sizes="40px" className="rounded-full object-cover" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: '#e9731633', color: '#e97316' }}>
                  <span className="text-sm font-black">{(activeEditorialNote.author_name ?? '?')[0]}</span>
                </div>
              )}
              <div>
                <p className="text-sm font-bold">{activeEditorialNote.author_name ?? 'Редактор'}</p>
                <p className="text-[10px] opacity-50">
                  {new Date(activeEditorialNote.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <blockquote
              className="border-l-2 pl-3 text-sm italic leading-relaxed opacity-80"
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
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 text-xs font-black uppercase tracking-[0.1em]"
                      style={{ backgroundColor: '#16a34a', color: t.bg }}
                    >
                      <Check className="h-3 w-3" /> Решено
                    </button>
                    <button
                      onClick={() => updateEditorialNoteStatus(activeEditorialNote.id, 'ignored')}
                      className="h-8 flex-1 border text-xs transition-opacity hover:opacity-60"
                      style={{ borderColor: `${t.text}20` }}
                    >
                      Игнорировать
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => updateEditorialNoteStatus(activeEditorialNote.id, 'open')}
                    className="h-8 flex-1 border text-xs transition-opacity hover:opacity-60"
                    style={{ borderColor: `${t.text}20` }}
                  >
                    Вернуть в работу
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!confirm('Удалить замечание?')) return
                    deleteEditorialNote(activeEditorialNote.id)
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center border transition-opacity hover:opacity-60"
                  style={{ borderColor: `${t.text}20` }}
                  aria-label="Удалить замечание"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
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
                <div className="relative h-10 w-10">
                  <Image src={activeHighlight.user_avatar} alt={activeHighlight.user_name ?? ''} fill sizes="40px" className="rounded-full object-cover" />
                </div>
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
          onUpdate={updateHighlight}
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

// findTextRange переэкспортируем так чтобы не импортировать highlights-dom в тесте напрямую
export { findTextRange }
