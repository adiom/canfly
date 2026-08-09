'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Clock, X } from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import type { AutocompleteItem } from '@/lib/server/search'
import { highlight } from '@/lib/search-highlight'
import { getRecentSearches, addRecentSearch, clearRecentSearches } from '@/lib/search-recent'
import { CATALOG_PATH } from '@/lib/nav'

export function SearchDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AutocompleteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [recents, setRecents] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (next) setRecents(getRecentSearches())
  }, [])

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handleOpenChange(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleOpenChange])

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    // Отменить предыдущий запрос
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, {
        signal: controller.signal,
      })
      if (!res.ok) {
        setResults([])
        return
      }
      const data = await res.json()
      setResults(data.results ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchResults(value), 300)
    },
    [fetchResults],
  )

  const saveAndNavigate = useCallback(
    (q: string, href: string) => {
      addRecentSearch(q)
      setOpen(false)
      setQuery('')
      setResults([])
      router.push(href)
    },
    [router],
  )

  const handleSelect = useCallback(
    (href: string) => {
      addRecentSearch(query)
      setOpen(false)
      setQuery('')
      setResults([])
      router.push(href)
    },
    [query, router],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && query.trim().length >= 2) {
        saveAndNavigate(query.trim(), `/search?q=${encodeURIComponent(query.trim())}`)
      }
    },
    [query, saveAndNavigate],
  )

  const handleClearRecents = useCallback(() => {
    clearRecentSearches()
    setRecents([])
  }, [])

  const releases = results.filter((r) => r.kind === 'release')
  const characters = results.filter((r) => r.kind === 'character')
  const news = results.filter((r) => r.kind === 'news')

  const isEmpty = query.length < 2

  return (
    <>
      <button
        onClick={() => handleOpenChange(true)}
        className="flex h-10 w-10 cursor-pointer touch-manipulation items-center justify-center rounded-sm border border-cf-text-1/12 text-cf-text-2 transition-colors hover:bg-cf-text-1/8"
        aria-label="Поиск (Cmd+K)"
      >
        <Search className="h-5 w-5" />
      </button>

      <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
        <CommandInput
          placeholder="Книги, персонажи, новости…"
          value={query}
          onValueChange={handleQueryChange}
          onKeyDown={handleKeyDown}
        />

        {/* Пустое состояние — недавние запросы + быстрые ссылки */}
        {isEmpty && (
          <>
            {recents.length > 0 && (
              <CommandGroup
                heading={
                  <span className="flex items-center justify-between w-full">
                    <span>Недавнее</span>
                    <button
                      onClick={handleClearRecents}
                      className="ml-auto flex items-center gap-1 text-[10px] text-cf-text-3 hover:text-cf-text-2 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Очистить
                    </button>
                  </span>
                }
              >
                {recents.map((q) => (
                  <CommandItem
                    key={q}
                    value={`recent-${q}`}
                    onSelect={() => {
                      setQuery(q)
                      fetchResults(q)
                    }}
                  >
                    <Clock className="mr-2 h-4 w-4 flex-shrink-0 text-cf-text-3" />
                    <span className="text-sm text-cf-text-2">{q}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Перейти">
              <CommandItem value="__nav_releases" onSelect={() => saveAndNavigate('', CATALOG_PATH)}>
                <Search className="mr-2 h-4 w-4 flex-shrink-0 text-cf-text-3" />
                <span className="text-sm text-cf-text-2">Все релизы</span>
              </CommandItem>
              <CommandItem value="__nav_characters" onSelect={() => saveAndNavigate('', '/characters')}>
                <Search className="mr-2 h-4 w-4 flex-shrink-0 text-cf-text-3" />
                <span className="text-sm text-cf-text-2">Персонажи</span>
              </CommandItem>
              <CommandItem value="__nav_news" onSelect={() => saveAndNavigate('', '/news')}>
                <Search className="mr-2 h-4 w-4 flex-shrink-0 text-cf-text-3" />
                <span className="text-sm text-cf-text-2">Новости</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Результаты поиска */}
        {!isEmpty && !loading && results.length === 0 && (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        )}

        {!isEmpty && (
          <CommandGroup heading="">
            <CommandItem
              value={`__search__${query}`}
              onSelect={() => saveAndNavigate(query.trim(), `/search?q=${encodeURIComponent(query.trim())}`)}
              className="text-cf-text-3"
            >
              <Search className="mr-2 h-4 w-4 flex-shrink-0" />
              <span>Искать «{query}» — все результаты</span>
            </CommandItem>
          </CommandGroup>
        )}

        {releases.length > 0 && (
          <CommandGroup heading="Релизы">
            {releases.map((item) => (
              <CommandItem
                key={item.id}
                value={`release-${item.id}`}
                onSelect={() => handleSelect(item.href)}
              >
                <div className="relative mr-3 h-10 w-7 flex-shrink-0 overflow-hidden rounded-sm bg-cf-bg-2">
                  {item.image ? (
                    <Image src={item.image} alt={item.title} fill className="object-cover" sizes="28px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#d52525]/20">
                      <span className="text-xs font-black text-[#d52525]">{item.title[0]}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{highlight(item.title, query)}</span>
                  <span className="text-xs text-cf-text-3">{item.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {characters.length > 0 && (
          <CommandGroup heading="Персонажи">
            {characters.map((item) => (
              <CommandItem
                key={item.id}
                value={`character-${item.id}`}
                onSelect={() => handleSelect(item.href)}
              >
                <div className="relative mr-3 h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-cf-bg-2">
                  {item.image ? (
                    <Image src={item.image} alt={item.title} fill className="object-cover" sizes="32px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#d52525]/20">
                      <span className="text-xs font-black text-[#d52525]">{item.title[0]}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{highlight(item.title, query)}</span>
                  <span className="text-xs text-cf-text-3">{item.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {news.length > 0 && (
          <CommandGroup heading="Новости">
            {news.map((item) => (
              <CommandItem
                key={item.id}
                value={`news-${item.id}`}
                onSelect={() => handleSelect(item.href)}
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{highlight(item.title, query)}</span>
                  <span className="text-xs text-cf-text-3">{item.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Футер-подсказки клавиш */}
        <div className="border-t border-cf-text-1/10 px-3 py-2 flex items-center gap-4">
          <span className="text-[10px] text-cf-text-3">↑↓ навигация</span>
          <span className="text-[10px] text-cf-text-3">↵ открыть</span>
          <span className="text-[10px] text-cf-text-3">esc закрыть</span>
        </div>
      </CommandDialog>
    </>
  )
}
