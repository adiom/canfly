'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BookWithCharacters } from '@/lib/types'
import { useCart } from '@/lib/cart-context'

interface ComicReaderProps {
  book: BookWithCharacters
}

export function ComicReader({ book }: ComicReaderProps) {
  const pages = book.preview_pages || []
  const [, setLoadedPages] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(0) // для прогресс-бара
  const [showUI, setShowUI] = useState(true)
  const [uiTimeout, setUiTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const { addItem } = useCart()

  // Intersection Observer — отслеживаем текущую страницу для прогресс-бара
  useEffect(() => {
    if (pages.length === 0) return

    const observers: IntersectionObserver[] = []

    pageRefs.current.forEach((el, index) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            setCurrentPage(index)
          }
        },
        { threshold: 0.3 }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach(obs => obs.disconnect())
  }, [pages.length])

  const scrollToPage = useCallback((index: number) => {
    pageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Клавиатурная навигация
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        scrollToPage(Math.min(pages.length - 1, currentPage + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        scrollToPage(Math.max(0, currentPage - 1))
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentPage, pages.length, scrollToPage, toggleFullscreen])

  // Автоскрытие UI при скролле
  const resetUiTimer = useCallback(() => {
    setShowUI(true)
    if (uiTimeout) clearTimeout(uiTimeout)
    const t = setTimeout(() => setShowUI(false), 3000)
    setUiTimeout(t)
  }, [uiTimeout])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', resetUiTimer, { passive: true })
    el.addEventListener('touchstart', resetUiTimer, { passive: true })
    return () => {
      el.removeEventListener('scroll', resetUiTimer)
      el.removeEventListener('touchstart', resetUiTimer)
    }
  }, [resetUiTimer])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handleAddToCart = () => {
    if (!book.price) return
    addItem({
      bookId: book.id,
      title: book.title,
      price: book.price,
      quantity: 1,
      image: book.cover_image,
    })
  }

  const progress = pages.length > 1 ? (currentPage / (pages.length - 1)) * 100 : 100

  if (pages.length === 0) {
    return (
      <div className="min-h-screen bg-[#111210] flex items-center justify-center">
        <p className="text-[#ded7cc]/50 text-sm">Страницы не добавлены</p>
      </div>
    )
  }

  return (
    <div className="relative bg-[#0a0a09] min-h-screen">
      {/* Прогресс-бар */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-[#f4efe5]/10">
        <div
          className="h-full bg-[#d52525] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Верхний UI — появляется/скрывается */}
      <header
        className={`fixed top-0.5 left-0 right-0 z-40 transition-all duration-300 ${
          showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
          <Link
            href={`/books/${book.slug}`}
            className="flex items-center gap-2 text-[#f4efe5]/70 hover:text-[#f4efe5] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-sm font-medium truncate max-w-[160px]">{book.title}</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#f4efe5]/40 tabular-nums">
              {currentPage + 1} / {pages.length}
            </span>
            <button
              onClick={toggleFullscreen}
              className="p-2 text-[#f4efe5]/60 hover:text-[#f4efe5] transition-colors"
              title="Полный экран (F)"
            >
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="8 3 3 3 3 8" /><polyline points="21 8 21 3 16 3" />
                  <polyline points="3 16 3 21 8 21" /><polyline points="16 21 21 21 21 16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Страницы — вертикальный скролл */}
      <div
        ref={containerRef}
        className="w-full"
        onClick={resetUiTimer}
      >
        {pages.map((url, index) => (
          <div
            key={index}
            ref={el => { pageRefs.current[index] = el }}
            className="relative w-full flex justify-center"
          >
            {/* Lazy load: рендерим только ±2 страницы от текущей */}
            {Math.abs(index - currentPage) <= 3 ? (
              <Image
                src={url}
                alt={`Страница ${index + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                className="w-full max-w-[720px] block object-cover"
                style={{ display: 'block' }}
                onLoad={() => setLoadedPages(prev => new Set(prev).add(index))}
              />
            ) : (
              // Плейсхолдер для не загруженных страниц
              <div
                className="w-full max-w-[720px] bg-[#111210]"
                style={{ aspectRatio: '3/4', minHeight: '400px' }}
              />
            )}
          </div>
        ))}

        {/* Конец комикса */}
        <div className="flex flex-col items-center gap-6 py-16 px-4 max-w-[720px] mx-auto">
          <div className="w-12 h-px bg-[#f4efe5]/20" />
          <p className="text-[#f4efe5]/40 text-xs uppercase tracking-[0.18em]">Конец</p>

          {book.price && (
            <div className="w-full border border-[#f4efe5]/10 rounded p-6 flex flex-col items-center gap-4 text-center">
              {book.cover_image && (
                <div className="relative w-20 h-28">
                  <Image
                    src={book.cover_image}
                    alt={book.title}
                    fill
                    sizes="80px"
                    className="object-cover rounded"
                  />
                </div>
              )}
              <div>
                <p className="text-[#f4efe5] font-black uppercase text-sm mb-1">{book.title}</p>
                <p className="text-[#f4efe5]/40 text-xs">Полная версия</p>
              </div>
              <p className="text-[#f6d6a8] font-black text-xl">
                {(book.price / 100).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
              </p>
              <button
                onClick={handleAddToCart}
                className="h-12 px-8 bg-[#d52525] text-white font-black uppercase text-sm hover:bg-[#b81f1f] transition-colors"
              >
                Купить
              </button>
            </div>
          )}

          <Link
            href="/shop"
            className="text-[#f4efe5]/40 hover:text-[#f4efe5] text-xs uppercase tracking-[0.18em] transition-colors"
          >
            ← Все комиксы
          </Link>
        </div>
      </div>

      {/* Нижний UI — быстрая навигация по страницам */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
          showUI ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={() => scrollToPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-2 text-[#f4efe5]/60 hover:text-[#f4efe5] disabled:opacity-20 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          {/* Миниатюры страниц — горизонтальный скролл */}
          <div className="flex-1 overflow-x-auto mx-2 scrollbar-none">
            <div className="flex gap-1.5 justify-center">
              {pages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i)}
                  className={`flex-shrink-0 w-8 h-10 rounded overflow-hidden border transition-all ${
                    i === currentPage
                      ? 'border-[#d52525] opacity-100 scale-110'
                      : 'border-[#f4efe5]/10 opacity-40 hover:opacity-70'
                  }`}
                >
                  <Image src={url} alt={`Страница ${i + 1}`} fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => scrollToPage(Math.min(pages.length - 1, currentPage + 1))}
            disabled={currentPage === pages.length - 1}
            className="p-2 text-[#f4efe5]/60 hover:text-[#f4efe5] disabled:opacity-20 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
