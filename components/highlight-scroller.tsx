'use client'

import { useEffect } from 'react'

interface HighlightScrollerProps {
  highlightId: string
  /** Фолбэк, если `<mark>` не отрисовался (текст главы изменился). */
  paragraphIndex?: number | null
}

const RETRIES = 3
const RETRY_DELAY = 400
const OUTLINE_MS = 2000

/**
 * Скроллит к цитате после гидрации читалки.
 * Разметка `<mark>` появляется асинхронно, поэтому пробуем несколько раз;
 * если не нашли — скроллим к параграфу по индексу.
 */
export function HighlightScroller({ highlightId, paragraphIndex }: HighlightScrollerProps) {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let done = false

    const flash = (el: HTMLElement) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.outline = '2px solid var(--cf-accent, #d52525)'
      el.style.outlineOffset = '2px'
      timers.push(
        setTimeout(() => {
          el.style.outline = ''
          el.style.outlineOffset = ''
        }, OUTLINE_MS),
      )
    }

    const attempt = (n: number) => {
      if (done) return
      const mark = document.querySelector<HTMLElement>(`mark[data-cf-hl="${highlightId}"]`)
      if (mark) {
        done = true
        flash(mark)
        return
      }
      if (n < RETRIES) {
        timers.push(setTimeout(() => attempt(n + 1), RETRY_DELAY))
        return
      }
      // Фолбэк: параграф по индексу
      if (paragraphIndex == null) return
      const paragraphs = document.querySelectorAll<HTMLElement>('.prose p')
      const el = paragraphs[paragraphIndex]
      if (!el) return
      done = true
      flash(el)
    }

    timers.push(setTimeout(() => attempt(0), 600))

    return () => {
      done = true
      timers.forEach(clearTimeout)
    }
  }, [highlightId, paragraphIndex])

  return null
}
