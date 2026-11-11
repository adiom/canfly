'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUpRight, LoaderCircle } from 'lucide-react'
import { z } from 'zod'
import { feedPageSchema, type FeedPage } from '@/lib/v2-feed'
import { JournalItem } from './journal-item'
import styles from './journal.module.css'

const STORAGE_KEY = 'canfly:v2:journal:1'
const savedSchema = z.object({ pages: z.array(feedPageSchema).min(1).max(30), y: z.number().min(0), time: z.number(), resume: z.boolean() })

export function Journal({ initialPage }: { initialPage: FeedPage }) {
  const [pages, setPages] = useState([initialPage])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const request = useRef<AbortController | null>(null)
  const savedPages = useRef(pages)
  const restored = useRef(false)
  const nextCursor = pages.at(-1)?.nextCursor ?? null
  useEffect(() => { savedPages.current = pages }, [pages])

  // Restore a bounded, short-lived public feed on returning from a story.
  useEffect(() => {
    let record: z.infer<typeof savedSchema> | undefined
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      const parsed = raw ? savedSchema.safeParse(JSON.parse(raw)) : null
      if (parsed?.success && parsed.data.resume && parsed.data.pages.some((page) => page.items.length) && Date.now() - parsed.data.time < 10 * 60_000) record = parsed.data
    } catch { /* Storage can be disabled or full. Scrolling still works. */ }
    const frame = requestAnimationFrame(() => {
      if (record) { restored.current = true; setPages(record.pages) }
      setReady(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!ready) return
    let leaving = false
    if (restored.current) {
      restored.current = false
      try {
        const record = savedSchema.parse(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'))
        requestAnimationFrame(() => window.scrollTo({ top: record.y, behavior: 'instant' }))
      } catch { /* The browser can restore the position itself. */ }
    }
    const save = (resume = false) => {
      try {
        // Keep the beginning of the feed and its matching cursor chain together.
        if (savedPages.current.length <= 30) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ pages: savedPages.current, y: window.scrollY, time: Date.now(), resume }))
        else sessionStorage.removeItem(STORAGE_KEY)
      } catch { /* Quota errors must not break navigation. */ }
    }
    const onVisibility = () => { if (document.hidden) save(true) }
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null
      if (anchor && new URL(anchor.href, location.href).pathname !== location.pathname) {
        leaving = true
        save(true)
      }
    }
    const onPageHide = () => save(true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      // Next may already have reset scrollY by cleanup; keep the position saved on click.
      if (!leaving) save(true)
      request.current?.abort()
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [ready])

  const loadMore = useCallback(async () => {
    if (!nextCursor || request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(false)
    const timeout = window.setTimeout(() => controller.abort('timeout'), 20_000)
    try {
      const response = await fetch(`/api/v2/feed?cursor=${encodeURIComponent(nextCursor)}`, { signal: controller.signal })
      if (!response.ok) throw new Error('Feed request failed')
      const page = feedPageSchema.parse(await response.json())
      if (page.nextCursor === nextCursor) throw new Error('Cursor did not advance')
      setPages((current) => {
        const seen = new Set(current.flatMap((part) => part.items.map((item) => item.id)))
        return [...current, { ...page, items: page.items.filter((item) => !seen.has(item.id)) }]
      })
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setError(true)
    } finally {
      window.clearTimeout(timeout)
      request.current = null
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setLoading(false)
    }
  }, [nextCursor])

  useEffect(() => {
    if (!ready || error || !nextCursor || !sentinel.current || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    }, { rootMargin: '600px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [ready, error, nextCursor, loadMore])

  const items = pages.flatMap((page) => page.items)
  return (
    <section className={styles.journal} id="journal" aria-labelledby="journal-title">
      <header className={styles.intro}>
        <h2 id="journal-title">Истории рядом<span className={styles.dot}>.</span></h2>
        <p>Читай фрагменты. Знакомься с людьми.<br />Находи свои истории.</p>
        <ArrowDown size={22} strokeWidth={1} aria-hidden="true" />
      </header>
      <div aria-busy={loading}>
        {items.map((item, index) => <JournalItem key={item.id} item={item} number={index + 1} />)}
      </div>
      <div ref={sentinel} className={styles.continuation}>
        <p role="status" aria-live="polite">{error ? 'Не получилось загрузить продолжение. Уже открытые материалы остались на месте.' : loading ? 'Находим следующую историю…' : !items.length ? 'Новые фрагменты появятся здесь после публикации.' : !nextCursor ? 'Пока всё. В каждой истории есть куда пойти дальше.' : ''}</p>
        {nextCursor ? <button type="button" onClick={() => void loadMore()} disabled={loading || !ready} className={styles.loadMore}>
          {loading ? <LoaderCircle size={17} className={styles.spinner} aria-hidden="true" /> : <ArrowDown size={17} aria-hidden="true" />}
          {error ? 'Попробовать снова' : 'Ещё истории'}
        </button> : <Link href="/releases" className={styles.sourceLink}>Все произведения<ArrowUpRight size={17} aria-hidden="true" /></Link>}
        <noscript><p>Первые материалы доступны без JavaScript. <a href="/releases">Все произведения</a></p></noscript>
      </div>
    </section>
  )
}
