'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const SPINE_WIDTH = 48
const SPREAD_BREAKPOINT = 900

export interface PaginationState {
  pageCount: number
  currentPage: number
  isSpread: boolean
  pageWidth: number
  pageHeight: number
  gutter: number
}

/**
 * Хук CSS-column пагинации.
 *
 * Viewport (viewportRef) — контейнер с overflow:hidden фиксированных размеров.
 * Track (trackRef) — внутренний div с column-width/column-gap/column-fill:auto.
 * Браузер разбивает контент на колонки; каждая колонка = одна страница.
 * Перелистывание = translateX на trackRef.
 */
export function useColumnPagination(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  trackRef: React.RefObject<HTMLDivElement | null>,
  fontSize: number,
  chapterKey: string,
): PaginationState & {
  setCurrentPage: (page: number) => void
  remeasure: () => void
} {
  const [state, setState] = useState<PaginationState>({
    pageCount: 1,
    currentPage: 0,
    isSpread: false,
    pageWidth: 480,
    pageHeight: 640,
    gutter: 0,
  })

  // Ref для чтения текущего state в колбэках без closure-устарелости
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const measure = useCallback(() => {
    const vp = viewportRef.current
    const track = trackRef.current
    if (!vp || !track) return

    const vpW = vp.clientWidth
    const vpH = vp.clientHeight
    if (vpW === 0 || vpH === 0) return

    const spread = vpW >= SPREAD_BREAKPOINT
    const gutter = spread ? SPINE_WIDTH : 0
    const pageW = spread ? Math.floor((vpW - gutter) / 2) : vpW
    const pageH = vpH
    const colStep = pageW + gutter

    // scrollWidth читаем после layout (называемый из rAF или useLayoutEffect)
    const scrollW = track.scrollWidth
    const pageCount = Math.max(1, Math.round((scrollW + gutter) / colStep))

    setState(prev => {
      const pagesPerView = spread ? 2 : 1
      const maxPage = Math.max(0, pageCount - pagesPerView)
      let newPage = Math.min(prev.currentPage, maxPage)
      if (spread && newPage % 2 !== 0) newPage = Math.max(0, newPage - 1)
      newPage = Math.max(0, newPage)

      if (
        prev.pageCount === pageCount &&
        prev.isSpread === spread &&
        prev.pageWidth === pageW &&
        prev.pageHeight === pageH &&
        prev.currentPage === newPage
      ) return prev

      return { pageCount, currentPage: newPage, isSpread: spread, pageWidth: pageW, pageHeight: pageH, gutter }
    })
  }, [viewportRef, trackRef])

  const remeasure = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(measure))
  }, [measure])

  // Измеряем при смене главы или размера шрифта
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(measure))
    document.fonts.ready.then(measure)
    return () => cancelAnimationFrame(id)
  }, [chapterKey, fontSize, measure])

  // ResizeObserver на viewport
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(measure, 80)
    })
    observer.observe(vp)
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [viewportRef, measure])

  const setCurrentPage = useCallback((page: number) => {
    setState(prev => {
      const pagesPerView = prev.isSpread ? 2 : 1
      const maxPage = Math.max(0, prev.pageCount - pagesPerView)
      let newPage = Math.max(0, Math.min(page, maxPage))
      if (prev.isSpread && newPage % 2 !== 0) newPage = Math.max(0, newPage - 1)
      return { ...prev, currentPage: newPage }
    })
  }, [])

  return { ...state, setCurrentPage, remeasure }
}
