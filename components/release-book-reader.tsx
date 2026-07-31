'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X, AlignJustify, Heart, Quote, MessageCircle, Check, Bookmark, BookmarkPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { Release, Edition, Chapter, ChapterHighlight, ChapterEditorialNote, EditorialNoteStatus } from '@/lib/releases-types'
import type { UserRole } from '@/lib/types'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { HighlightArtifact } from '@/components/highlight-artifact'

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
  const bg = release.design_config?.bg_color ?? 'var(--cf-bg)'
  const textColor = release.design_config?.text_color ?? 'var(--cf-text-1)'
  const isEditor = userRole === 'editor' || userRole === 'admin'

  const [currentIndex, setCurrentIndex] = useState(initialChapterIndex)
  const [showToc, setShowToc] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [highlights, setHighlights] = useState<ChapterHighlight[]>(initialHighlights)
  const [editorialNotes, setEditorialNotes] = useState<ChapterEditorialNote[]>([])
  const [selection, setSelection] = useState<SelectionData | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<ChapterHighlight | null>(null)
  const [activeEditorialNote, setActiveEditorialNote] = useState<ChapterEditorialNote | null>(null)
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

  // Editorial notes текущей главы
  const chapterEditorialNotes = useMemo(
    () => editorialNotes.filter(n => n.chapter_id === currentChapter?.id),
    [editorialNotes, currentChapter],
  )

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlights refetch only on chapter change
  }, [currentChapter?.id])

  // Подгружаем editorial notes при смене главы (editor/admin)
  useEffect(() => {
    if (!currentChapter || !isEditor) return
    if (editorialNotes.some(n => n.chapter_id === currentChapter.id)) return
    let cancelled = false
    fetch(`/api/chapter-editorial-notes?chapterId=${currentChapter.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.data) return
        setEditorialNotes(prev => {
          const ids = new Set(prev.map(n => n.id))
          return [...prev, ...data.data.filter((n: ChapterEditorialNote) => !ids.has(n.id))]
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editorialNotes refetch only on chapter change
  }, [currentChapter?.id, isEditor])

  // Применяем подсветки к DOM после рендера
  useEffect(() => {
    const root = contentRef.current
    if (!root || !currentChapter) return

    let cancelled = false

    // Снимаем старые подсветки (highlights + editorial notes)
    root.querySelectorAll('mark[data-cf-hl], mark[data-cf-en]').forEach(el => {
      const parent = el.parentNode
      if (!parent) return
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
      parent.normalize()
    })

    // Собираем параграфы в порядке DOM
    const paragraphs: HTMLElement[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_REJECT
        const tag = node.tagName.toLowerCase()
        if (['p', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) {
          return NodeFilter.FILTER_ACCEPT
        }
        return NodeFilter.FILTER_SKIP
      },
    })
    let node: Node | null = walker.nextNode()
    while (node) {
      paragraphs.push(node as HTMLElement)
      node = walker.nextNode()
    }
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
      for (const hl of list) wrapHighlight(p, hl, currentUserId)
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

  // Скролл наверх + синхронизация URL при смене главы. setState в effect —
  // reset selection/artifact при навигации (sync с currentIndex).
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const chapterUrl = edition.format === 'book'
      ? `/release/${release.slug}/book/${edition.quality_tier}/${currentIndex + 1}`
      : `/release/${release.slug}/${edition.slug}/${currentIndex + 1}`
    window.history.replaceState(null, '', chapterUrl)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection/artifact on chapter navigation
    setSelection(null)
    setArtifactOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL sync on chapter index only
  }, [currentIndex, release.slug, edition.slug])

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
  }, [chapterHighlights, chapterEditorialNotes])

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
        if (['p', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) {
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
          if (['p', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'li'].includes(t)) {
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

    setSelection({ text, rect, paragraphIndex, contextBefore, contextAfter })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentUserId checked inside, stable callback
  }, [])

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

  const saveEditorialFromArtifact = async (noteText: string) => {
    if (!selection || !currentChapter) return
    const res = await fetch('/api/chapter-editorial-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapter_id: currentChapter.id,
        text_content: selection.text,
        paragraph_index: selection.paragraphIndex,
        context_before: selection.contextBefore,
        context_after: selection.contextAfter,
        note: noteText,
      }),
    })
    const data = await res.json()
    if (res.ok && data.data) {
      setEditorialNotes([data.data, ...editorialNotes])
      toast.success('Замечание отправлено')
      setSelection(null)
      window.getSelection()?.removeAllRanges()
    } else {
      toast.error(data.error ?? 'Ошибка сохранения')
    }
  }

  const updateEditorialNoteStatus = async (id: string, status: EditorialNoteStatus) => {
    const res = await fetch(`/api/chapter-editorial-notes/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      setEditorialNotes(editorialNotes.map(n =>
        n.id === id ? data.data : n,
      ))
      if (activeEditorialNote?.id === id) {
        setActiveEditorialNote(data.data)
      }
      toast.success(status === 'resolved' ? 'Замечание решено' : 'Замечание проигнорировано')
    } else {
      toast.error('Ошибка')
    }
  }

  const toggleLike = async (id: string) => {
    if (!currentUserId) {
      toast.error('Войдите чтобы ставить лайки')
      return
    }
    const res = await fetch(`/api/chapter-highlights/${id}/like`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setHighlights(highlights.map(h =>
        h.id === id ? { ...h, is_liked_by_me: data.data.liked, likes_count: data.data.likes_count } : h,
      ))
      if (activeHighlight?.id === id) {
        setActiveHighlight({ ...activeHighlight, is_liked_by_me: data.data.liked, likes_count: data.data.likes_count })
      }
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

          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontSize(s => Math.max(14, s - 2))}
              className="px-2 py-1.5 text-xs font-black transition-opacity hover:opacity-60"
              style={{ color: textColor }}
              aria-label="Уменьшить шрифт"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize(s => Math.min(26, s + 2))}
              className="px-2 py-1.5 text-sm font-black transition-opacity hover:opacity-60"
              style={{ color: textColor }}
              aria-label="Увеличить шрифт"
            >
              A+
            </button>
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
            onMouseUp={handleMouseUp}
            className="prose max-w-none leading-8 prose-p:mb-5"
            style={{
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
                href="/releases"
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
          className="fixed z-[100] flex items-center overflow-hidden rounded-full shadow-2xl"
          style={{
            top: Math.max(60, selection.rect.top - 52),
            left: Math.max(8, Math.min(window.innerWidth - 200, selection.rect.left + selection.rect.width / 2 - 96)),
            backgroundColor: '#0e0d0c',
            border: '1px solid rgba(244,239,229,0.12)',
          }}
          onMouseDown={e => e.preventDefault()}
        >
          {/* Метка цитаты */}
          <span
            className="pl-4 pr-2 font-[family-name:var(--font-cormorant)] text-[13px] italic opacity-50 select-none"
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
            <span className="hidden sm:inline">Артефакт</span>
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

            {isEditor && activeEditorialNote.status === 'open' && (
              <div className="mt-5 flex gap-2">
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
                href={edition.format === 'book'
                  ? `/release/${release.slug}/book/${edition.quality_tier}/full`
                  : `/release/${release.slug}/${edition.slug}/full`
                }
                onClick={() => setShowToc(false)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.1em] transition-opacity hover:opacity-80"
                style={{ color: accent }}
              >
                <Quote className="h-4 w-4" />
                Читать одним файлом
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
              {otherBookEditions.map(other => {
                const tierLabel: Record<string, string> = {
                  draft: 'Черновик',
                  standard: 'Книга',
                  premium: 'Иллюстрированная',
                }
                return (
                  <Link
                    key={other.id}
                    href={`/release/${release.slug}/book/${other.quality_tier}/1`}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:border-current"
                    style={{
                      borderColor: `${textColor}20`,
                      color: other.quality_tier === edition.quality_tier ? accent : textColor,
                      backgroundColor: other.quality_tier === edition.quality_tier ? `${accent}15` : 'transparent',
                    }}
                  >
                    {tierLabel[other.quality_tier] ?? other.quality_tier}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Общий поиск текстового диапазона для обёртки в <mark>. Используется и хайлайтами,
 * и редакторскими замечаниями — устраняет дублирование TreeWalker-логики.
 *
 * Ищет точное совпадение text, при промахе пробует контекстный fallback
 * (context_before + префикс text). Возвращает Range или null.
 */
function findTextRange(
  paragraph: HTMLElement,
  text: string,
  contextBefore?: string | null,
): Range | null {
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let n: Node | null = walker.nextNode()
  while (n) {
    textNodes.push(n as Text)
    n = walker.nextNode()
  }

  for (const node of textNodes) {
    if (node.parentElement?.tagName === 'MARK') continue
    const nodeText = node.textContent ?? ''
    let idx = nodeText.indexOf(text)
    if (idx === -1 && contextBefore) {
      // Контекстный fallback: нашли context_before → сверяем префикс text
      const foundAt = nodeText.indexOf(contextBefore)
      if (foundAt >= 0) {
        const tail = nodeText.slice(foundAt + contextBefore.length, foundAt + contextBefore.length + text.length + 10)
        if (tail.startsWith(text.slice(0, 20))) {
          idx = foundAt + contextBefore.length
        }
      }
    }
    if (idx === -1) continue

    try {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + text.length)
      return range
    } catch {
      // кросс-узел / невалидный offset — пробуем следующий узел
    }
  }
  return null
}

/** Применяет общие стили <mark> + hover-эффект. */
function styleMark(mark: HTMLElement, color: string, idleOpacity: string) {
  mark.style.cursor = 'pointer'
  mark.style.borderRadius = '2px'
  mark.style.padding = '0 1px'
  mark.style.transition = 'background-color 0.15s'
  const idle = `${color}${idleOpacity}`
  mark.style.backgroundColor = idle
  mark.addEventListener('mouseenter', () => { mark.style.backgroundColor = `${color}88` })
  mark.addEventListener('mouseleave', () => { mark.style.backgroundColor = idle })
}

// Обёртывает найденный текст в <mark>
function wrapHighlight(paragraph: HTMLElement, hl: ChapterHighlight, currentUserId: string | null) {
  const text = hl.text_content
  if (!text) return

  const range = findTextRange(paragraph, text, hl.context_before)
  if (!range) return

  try {
    const mark = document.createElement('mark')
    mark.dataset.cfHl = hl.id
    mark.dataset.cfMine = hl.user_id === currentUserId && !hl.is_public ? 'true' : ''
    styleMark(mark, accent_for_hl(hl), '44')
    range.surroundContents(mark)
  } catch {
    // не получилось окружить — пропускаем
  }
}

function wrapEditorialNote(paragraph: HTMLElement, en: ChapterEditorialNote) {
  const text = en.text_content
  if (!text) return

  const range = findTextRange(paragraph, text, en.context_before)
  if (!range) return

  try {
    const mark = document.createElement('mark')
    mark.dataset.cfEn = en.id
    const statusColor = en.status === 'open' ? '#e97316' : en.status === 'resolved' ? '#16a34a' : '#6b7280'
    const bgOpacity = en.status === 'open' ? '44' : en.status === 'resolved' ? '28' : '18'
    styleMark(mark, statusColor, bgOpacity)
    range.surroundContents(mark)
  } catch {
    // skip
  }
}

function accent_for_hl(_hl: ChapterHighlight): string {
  // Пока единый акцентный цвет проекта; зарезервировано под детерминированный
  // цвет по user_id в будущем.
  return '#d52525'
}
