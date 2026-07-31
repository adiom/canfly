'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { BookWithCharacters, Highlight, UserRole, UserProfile } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useCart } from '@/lib/cart-context'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ComicReader } from '@/components/comic-reader'
import { toast } from 'sonner'

export function BookReader({ book, initialHighlights = [], initialChapter = 0 }: { book: BookWithCharacters; initialHighlights?: Highlight[]; initialChapter?: number }) {
  if (book.type === 'comic') {
    return <ComicReader book={book} />
  }

  return <TextBookReader book={book} initialHighlights={initialHighlights} initialChapter={initialChapter} />
}

function TextBookReader({ book, initialHighlights = [], initialChapter = 0 }: { book: BookWithCharacters; initialHighlights?: Highlight[]; initialChapter?: number }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [currentChapter, setCurrentChapter] = useState(initialChapter)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [highlights] = useState<Highlight[]>(initialHighlights)
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null)
  const [isCreatingHighlight] = useState(false)
  const [chapterRatings, setChapterRatings] = useState<Record<number, number>>({})
  const [tocOpen, setTocOpen] = useState(false)

  const { addItem } = useCart()
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const floatingMenuRef = useRef<HTMLDivElement>(null)

  const pages = book.preview_pages || []
  const chapters = book.chapters || []
  const isBookMode = book.type === 'book' && chapters.length > 0

  const isAdmin = roles.includes('admin')
  const isEditor = roles.includes('editor')
  const isAuthor = roles.includes('author')

  const navigateToChapter = useCallback((chapterIndex: number) => {
    if (chapterIndex < 0 || chapterIndex >= chapters.length) return
    setCurrentChapter(chapterIndex)
    router.push(`/books/${book.slug}/${chapterIndex + 1}`, { scroll: false })
  }, [chapters.length, book.slug, router])

  useEffect(() => {
    fetch('/api/user/session')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const authenticated = !!data?.isAuthenticated
        setIsAuthenticated(authenticated)
        if (data?.user && authenticated) {
          setUser(data.user)
          setRoles(data.roles || [])
          fetch(`/api/chapters/rate?bookId=${book.id}`)
            .then(res => res.ok ? res.json() : null)
            .then(ratingsData => {
              if (ratingsData?.data) {
                setChapterRatings(ratingsData.data)
              }
            })
            .catch(err => console.error('Ошибка загрузки рейтингов:', err))
        }
      })
      .catch(() => {
        setIsAuthenticated(false)
      })
  }, [book.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isAuthenticated !== true) return

    const hash = window.location.hash
    if (!hash.startsWith('#highlight-')) return

    const highlightId = hash.replace('#highlight-', '')
    const target = highlights.find(h => h.id === highlightId)
    if (target && target.chapter_index !== currentChapter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- navigate to highlight chapter
      setCurrentChapter(target.chapter_index)
      return
    }

    const scrollToHighlight = () => {
      const el = document.querySelector(`[data-highlight-id="${highlightId}"]`)
      if (!el) return false
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2', 'transition-all')
      setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2'), 2500)
      return true
    }

    if (scrollToHighlight()) return

    const observer = new MutationObserver(() => {
      if (scrollToHighlight()) {
        observer.disconnect()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timeout = setTimeout(() => observer.disconnect(), 5000)

    return () => {
      observer.disconnect()
      clearTimeout(timeout)
    }
  }, [highlights, currentChapter, isAuthenticated])

  const handleSelection = useCallback(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() || ''
    if (sel && sel.rangeCount > 0 && text.length > 0) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelection({ text, rect })
    } else {
      if (!isCreatingHighlight) {
        setSelection(null)
      }
    }
  }, [isCreatingHighlight])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (floatingMenuRef.current?.contains(e.target as Node)) return
    handleSelection()
  }, [handleSelection])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (floatingMenuRef.current?.contains(e.target as Node)) return
    const attempts = [50, 150, 300]
    attempts.forEach((delay) => {
      setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim() || ''
        if (text.length > 0 && !selection) {
          handleSelection()
        }
      }, delay)
    })
  }, [handleSelection, selection])

  const handleRateChapter = async (rating: number) => {
    if (!user) {
      toast.error('Войдите, чтобы оценивать главы')
      return
    }
    try {
      const res = await fetch('/api/chapters/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          chapterIndex: currentChapter,
          rating,
        }),
      })
      if (res.ok) {
        setChapterRatings({ ...chapterRatings, [currentChapter]: rating })
        toast.success('Оценка сохранена')
      }
    } catch {
      toast.error('Ошибка при оценке')
    }
  }

  const [isAddedToCart, setIsAddedToCart] = useState(false)

  const handleAddToCart = useCallback(() => {
    addItem({
      bookId: book.id,
      title: book.title,
      price: book.price || 0,
      quantity: 1,
      image: book.cover_image,
    })
    setIsAddedToCart(true)
    setTimeout(() => setIsAddedToCart(false), 2000)
  }, [addItem, book])

  return (
    <main className={`min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 ${fullscreen ? 'flex flex-col' : ''}`}>
      {!fullscreen && (
        <header className="border-b border-slate-800 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Canfly
            </Link>
            <div className="flex gap-4 items-center">
              <Link href="/books" className="text-slate-300 hover:text-white transition-colors">
                ← Назад
              </Link>
              <Link href="/cart">
                <Button variant="outline" size="sm">Корзина</Button>
              </Link>
            </div>
          </div>
        </header>
      )}

      <section className={`flex-1 flex ${fullscreen ? 'flex-col' : ''}`}>
        {!fullscreen ? (
          <div className="max-w-7xl mx-auto px-4 py-12 w-full">
            <div className="flex flex-col md:grid md:grid-cols-4 gap-8">
              <div className="order-2 md:order-1 md:col-span-1 hidden md:block">
                {book.cover_image && (
                  <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-2xl mb-6">
                    <Image
                      src={book.cover_image}
                      alt={book.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <h1 className="text-2xl font-bold text-white mb-4">{book.title}</h1>
                <div className="inline-block px-3 py-1 bg-purple-900/50 text-purple-200 text-sm rounded-full mb-4 capitalize">
                  {book.type === 'book' && 'Книга'}
                  {book.type === 'audiobook' && 'Аудиокнига'}
                </div>
                {book.price && (
                  <div className="text-3xl font-bold text-purple-300 mb-6">
                    {(book.price / 100).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                  </div>
                )}
                <button
                  onClick={handleAddToCart}
                  className={
                    isAddedToCart
                      ? 'w-full h-11 px-4 bg-[#2d5016] border border-[#4a7c2a] text-xs font-black uppercase tracking-[0.12em] text-[#c8e6c9]'
                      : 'w-full h-11 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-[0.12em] transition-colors'
                  }
                >
                  {isAddedToCart ? '✓ Добавлено' : 'Добавить в корзину'}
                </button>
                {book.external_links && Object.keys(book.external_links).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-slate-400 text-sm font-medium">Купить в других магазинах:</p>
                    {Object.entries(book.external_links).map(([store, url]) => (
                      <a
                        key={store}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-center transition-colors text-sm"
                      >
                        {store}
                      </a>
                    ))}
                  </div>
                )}
                {book.characters && book.characters.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-medium text-slate-400">Персонажи:</p>
                    {book.characters.map((character) => (
                      <Link
                        key={character.id}
                        href={`/characters/${character.slug}`}
                        className="block rounded bg-slate-800 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
                      >
                        {character.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="order-1 md:order-2 md:col-span-3">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">Читать онлайн</h2>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {isBookMode && (
                        <Link href={`/books/${book.slug}/full`}>
                          <Button variant="outline" size="sm" className="text-xs">
                            Полная версия
                          </Button>
                        </Link>
                      )}
                      <button
                        onClick={handleAddToCart}
                        className={
                          isAddedToCart
                            ? 'inline-flex h-9 items-center justify-center border border-[#4a7c2a] bg-[#2d5016] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#c8e6c9]'
                            : 'inline-flex h-9 items-center justify-center border border-[#f4efe5]/14 px-3 text-xs font-black uppercase tracking-[0.12em] text-[#ded7cc] transition-colors hover:border-[#f6d6a8]/45 hover:text-white'
                        }
                      >
                        {isAddedToCart ? '✓ Добавлено' : 'В корзину'}
                      </button>
                    </div>
                  </div>

                  {isAuthenticated === null && (
                    <div className="py-16 text-center text-slate-400 text-sm animate-pulse">
                      Загрузка...
                    </div>
                  )}

                  {isAuthenticated === false && (
                    <div className="py-16 flex flex-col items-center gap-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-bold text-lg mb-2">Войдите, чтобы читать</p>
                        <p className="text-slate-400 text-sm max-w-xs">
                          Для доступа к содержимому необходимо войти в аккаунт
                        </p>
                      </div>
                      <Link
                        href={`/login?redirect=/books/${book.slug}`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
                      >
                        Войти в аккаунт
                      </Link>
                    </div>
                  )}

                  {isAuthenticated && isBookMode && (
                    <div className="flex flex-col md:grid md:grid-cols-4 gap-6">
                      <nav className="md:col-span-1">
                        <button
                          onClick={() => setTocOpen(!tocOpen)}
                          className="md:hidden w-full flex items-center justify-between px-4 py-3 bg-slate-700 rounded-lg mb-4 min-h-[44px]"
                        >
                          <span className="text-sm font-medium text-slate-200">
                            {chapters[currentChapter]?.title}
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${tocOpen ? 'rotate-180' : ''}`}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </button>
                        <div className={`${tocOpen ? 'block' : 'hidden'} md:block`}>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-[0.18em] mb-3 hidden md:block">
                            Оглавление
                          </p>
                          <ul className="space-y-1">
                            {chapters.map((ch, i) => (
                              <li key={i}>
                                <button
                                  onClick={() => {
                                    navigateToChapter(i)
                                    setTocOpen(false)
                                  }}
                                  className={[
                                    'w-full text-left px-3 py-2 rounded text-sm transition-colors min-h-[44px] flex items-center',
                                    i === currentChapter
                                      ? 'bg-purple-900/50 text-purple-200 font-medium'
                                      : 'text-slate-400 hover:text-white hover:bg-slate-700',
                                  ].join(' ')}
                                >
                                  <span className="text-xs text-slate-500 mr-2">{i + 1}.</span>
                                  {ch.title}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </nav>

                      <div className="md:col-span-3 relative">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
                          <h3 id={`chapter-${currentChapter + 1}`} className="text-lg font-bold text-white">
                            {chapters[currentChapter]?.title}
                          </h3>
                          <div className="flex gap-2">
                            {(isAdmin || isEditor) && (
                              <span className="text-[10px] uppercase tracking-wider bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                                Режим редактора
                              </span>
                            )}
                            {isAuthor && (
                              <span className="text-[10px] uppercase tracking-wider bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded border border-orange-800">
                                Режим автора
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          ref={contentRef}
                          onMouseUp={handleMouseUp}
                          onTouchEnd={handleTouchEnd}
                          className="relative"
                        >
                          <MarkdownRenderer
                            content={chapters[currentChapter]?.content}
                            highlights={highlights.filter(h => {
                              if (h.chapter_index !== currentChapter) return false
                              const isInternal = h.type === 'editorial_comment' || h.type === 'author_note'
                              if (isInternal) return isAdmin || isEditor || isAuthor
                              return h.user_id === user?.id
                            })}
                            className="mb-12"
                          />

                          {selection && (
                            <div
                              ref={floatingMenuRef}
                              onMouseDown={(e) => {
                                if ((e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault()
                              }}
                              onTouchStart={(e) => {
                                if ((e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault()
                              }}
                              className="fixed z-[100] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 flex flex-col gap-2 bottom-4 left-4 right-4 md:bottom-auto md:left-auto md:right-auto md:min-w-[240px] md:max-w-[320px]"
                              style={{
                                top: window.innerWidth >= 768 ? Math.max(10, selection.rect.top - 140) : undefined,
                                left: window.innerWidth >= 768 ? Math.max(10, Math.min(window.innerWidth - 260, selection.rect.left + (selection.rect.width / 2) - 120)) : undefined,
                              }}
                            >
                              <div className="text-[10px] text-slate-500 uppercase px-1">Выделено</div>
                              <div className="text-xs text-slate-300 bg-slate-800 p-2 rounded line-clamp-2 italic">
                                &ldquo;{selection.text}&rdquo;
                              </div>
                              <p className="text-[10px] text-slate-500 text-center py-1">
                                Цитаты временно недоступны
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="mt-12 pt-8 border-t border-slate-800 text-center">
                          <p className="text-sm text-slate-400 mb-4">Как вам эта глава?</p>
                          <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => handleRateChapter(star)}
                                className={`text-2xl transition-transform hover:scale-110 ${
                                  (chapterRatings[currentChapter] || 0) >= star ? 'text-yellow-400' : 'text-slate-700'
                                }`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          {chapterRatings[currentChapter] && (
                            <p className="text-xs text-slate-500 mt-2 italic">Оценка сохранена. Она поможет автору сделать книгу лучше.</p>
                          )}
                        </div>

                        <div className="mt-12 space-y-6">
                          <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            Активность читателей и редакторов
                          </h4>
                          <div className="space-y-4">
                            {highlights.filter(h => {
                              if (h.chapter_index !== currentChapter) return false
                              const isInternal = h.type === 'editorial_comment' || h.type === 'author_note'
                              if (isInternal) return isAdmin || isEditor || isAuthor
                              return h.user_id === user?.id
                            }).length === 0 && (
                              <p className="text-xs text-slate-500 italic">Пока нет отметок для этой главы.</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-6 border-t border-slate-700">
                          <button
                            onClick={() => navigateToChapter(currentChapter - 1)}
                            disabled={currentChapter === 0}
                            className="px-4 py-3 md:py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded transition-colors text-sm flex-shrink-0"
                          >
                            ← Предыдущая
                          </button>
                          <span className="text-slate-400 text-xs md:text-sm text-center">
                            Глава {currentChapter + 1} из {chapters.length}
                          </span>
                          <button
                            onClick={() => navigateToChapter(currentChapter + 1)}
                            disabled={currentChapter === chapters.length - 1}
                            className="px-4 py-3 md:py-2 min-h-[44px] bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded transition-colors text-sm flex-shrink-0"
                          >
                            Следующая →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isAuthenticated && !isBookMode && (
                    <div className="text-center py-12">
                      {book.description && (
                        <p className="text-slate-300 text-base mb-8 max-w-xl mx-auto leading-relaxed">
                          {book.description}
                        </p>
                      )}
                      {book.external_links && Object.keys(book.external_links).length > 0 ? (
                        <div className="space-y-6">
                          <p className="text-slate-400 text-sm font-medium">
                            Эта книга доступна на следующих площадках:
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                            {Object.entries(book.external_links).map(([store, url]) => (
                              <a
                                key={store}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-base transition-colors min-w-[200px]"
                              >
                                {store}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm">Скоро в продаже</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-black">
            <div className="flex justify-between items-center p-4 bg-slate-900/80 backdrop-blur border-b border-slate-700">
              <h2 className="text-white font-bold">{book.title}</h2>
              <button
                onClick={() => setFullscreen(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                Выход
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              {pages[currentPage] ? (
                <div className="relative w-full h-full max-w-full max-h-full">
                  <Image
                    src={pages[currentPage]}
                    alt={`Страница ${currentPage + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                  />
                </div>
              ) : (
                <p className="text-slate-400">Страница не найдена</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 p-4 bg-slate-900/80 backdrop-blur border-t border-slate-700">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-4 py-3 min-h-[44px] bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded transition-colors flex-shrink-0"
              >
                ← Назад
              </button>
              <div className="text-slate-300 text-sm text-center">
                {currentPage + 1} / {pages.length}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
                disabled={currentPage === pages.length - 1}
                className="px-4 py-3 min-h-[44px] bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded transition-colors flex-shrink-0"
              >
                Вперед →
              </button>
            </div>
          </div>
        )}
      </section>

      {!fullscreen && (
        <footer className="border-t border-slate-800 py-8 bg-slate-950/50">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>2026 &copy; Canfly</p>
          </div>
        </footer>
      )}
    </main>
  )
}
