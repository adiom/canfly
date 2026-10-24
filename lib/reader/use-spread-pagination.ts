'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clampPage } from '@/lib/reader/pagination'

export const SPINE_WIDTH = 56
const SPREAD_BREAKPOINT = 900
const SPREAD_MAX_PAGE_WIDTH = 720

export interface SpreadPaginationState {
  measured: boolean
  chapterKey: string
  pageCount: number
  currentPage: number
  isSpread: boolean
  pageWidth: number
  pageHeight: number
  gutter: number
  spreadWidth: number
  spineCenter: number
  leftPageEnd: number
  rightPageStart: number
}

/**
 * Хук пагинации книжного разворота (spread).
 *
 * Viewport (viewportRef) — контейнер с overflow:hidden фиксированных размеров.
 * Track (trackRef) — внутренний div с column-width/column-gap/column-fill:auto.
 * В режиме spread колонки делятся симметрично 50/50 относительно корешка,
 * gutter — зона корешка. Каждая страница имеет собственные отступы от
 * внешнего и внутреннего краёв (page-padding).
 *
 * Дополнительно хук возвращает геометрию для рендера:
 *   - spreadWidth     — общая ширина двух листов + корешок
 *   - spineCenter     — x-координата центра корешка внутри viewport
 *   - leftPageEnd     — правый край левой страницы (= spineCenter - gutter/2)
 *   - rightPageStart  — левый край правой страницы (= spineCenter + gutter/2)
 *
 * Симметрия 50/50: левый и правый лист имеют одинаковую ширину.
 */
export function useSpreadPagination(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  trackRef: React.RefObject<HTMLDivElement | null>,
  fontSize: number,
  chapterKey: string,
): SpreadPaginationState & {
  setCurrentPage: (page: number) => void
  remeasure: () => void
} {
  const [state, setState] = useState<SpreadPaginationState>({
    measured: false,
    chapterKey: '',
    pageCount: 1,
    currentPage: 0,
    isSpread: false,
    pageWidth: 480,
    pageHeight: 640,
    gutter: 0,
    spreadWidth: 480,
    spineCenter: 240,
    leftPageEnd: 240,
    rightPageStart: 240,
  })

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const measure = useCallback(() => {
    const vp = viewportRef.current
    const track = trackRef.current
    if (!vp || !track) return

    // clientWidth включает padding, а колонки живут в content-box. Без вычета
    // страница получалась шире области, в которой её видно, и overflow:hidden
    // срезал правый край строк.
    const cs = getComputedStyle(vp)
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const vpW = vp.clientWidth - padX
    const vpH = vp.clientHeight - padY
    if (vpW <= 0 || vpH <= 0) return

    const isPortrait = window.matchMedia('(orientation: portrait)').matches
    const spread = !isPortrait && vpW >= SPREAD_BREAKPOINT
    const gutter = spread ? SPINE_WIDTH : 0

    let pageW: number
    let spreadWidth: number
    let spineCenter: number

    if (spread) {
      pageW = Math.floor((vpW - gutter) / 2)
      if (pageW > SPREAD_MAX_PAGE_WIDTH) pageW = SPREAD_MAX_PAGE_WIDTH
      spreadWidth = pageW * 2 + gutter
      spineCenter = Math.floor(vpW / 2)
    } else {
      pageW = vpW
      spreadWidth = vpW
      spineCenter = Math.floor(vpW / 2)
    }

    const pageH = vpH
    const colStep = pageW + gutter

    const scrollW = track.scrollWidth
    const pageCount = Math.max(1, Math.round((scrollW + gutter) / colStep))

    const leftPageEnd = spread ? spineCenter - gutter / 2 : vpW
    const rightPageStart = spread ? spineCenter + gutter / 2 : 0

    setState(prev => {
      const newPage = clampPage(prev.chapterKey === chapterKey ? prev.currentPage : 0, pageCount, spread)

      if (
        prev.measured &&
        prev.chapterKey === chapterKey &&
        prev.pageCount === pageCount &&
        prev.isSpread === spread &&
        prev.pageWidth === pageW &&
        prev.pageHeight === pageH &&
        prev.gutter === gutter &&
        prev.spreadWidth === spreadWidth &&
        prev.spineCenter === spineCenter &&
        prev.leftPageEnd === leftPageEnd &&
        prev.rightPageStart === rightPageStart &&
        prev.currentPage === newPage
      ) return prev

      return {
        measured: true,
        chapterKey,
        pageCount,
        currentPage: newPage,
        isSpread: spread,
        pageWidth: pageW,
        pageHeight: pageH,
        gutter,
        spreadWidth,
        spineCenter,
        leftPageEnd,
        rightPageStart,
      }
    })
  }, [viewportRef, trackRef, chapterKey])

  const remeasure = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(measure))
  }, [measure])

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(measure))
    document.fonts.ready.then(measure)
    return () => cancelAnimationFrame(id)
  }, [chapterKey, fontSize, measure])

  useEffect(() => {
    let raf = 0
    let observer: ResizeObserver | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    // До гидрации читалка рендерит заглушку без viewport. Ранний выход по
    // `vp === null` оставлял наблюдение неподключённым навсегда — deps здесь
    // стабильны, второго прохода не будет. Поэтому ждём узел через rAF.
    const attach = () => {
      const vp = viewportRef.current
      if (!vp) {
        raf = requestAnimationFrame(attach)
        return
      }
      observer = new ResizeObserver(() => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(measure, 80)
      })
      observer.observe(vp)
      measure()
    }
    attach()

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [viewportRef, measure])

  const setCurrentPage = useCallback((page: number) => {
    setState(prev => {
      const newPage = clampPage(page, prev.pageCount, prev.isSpread)
      return { ...prev, currentPage: newPage }
    })
  }, [])

  return { ...state, setCurrentPage, remeasure }
}
