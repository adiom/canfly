'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react'

import type { GameAspectRatio } from '@/lib/releases-types'
import { cn } from '@/lib/utils'

/** Кадр игры такой же, как в БД: 9:16 не растягивается в широкую полосу. */
const FRAME: Record<GameAspectRatio, string> = {
  '16:9': 'aspect-[16/9]',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '9:16': 'aspect-[9/16]',
}

/** Горизонтальные игры на телефоне в портрете тесны — об этом стоит сказать. */
const HORIZONTAL_FRAMES: GameAspectRatio[] = ['16:9', '4:3']

const ACTION_CLASS =
  'inline-flex whitespace-nowrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-cf-text-2 transition-colors hover:text-cf-text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cf-air-accent-ink'

interface GameEmbedProps {
  slug: string
  title: string
  aspectRatio: GameAspectRatio
}

/**
 * Игра — статический бандл из `public/games/<slug>/`, поэтому встроить её
 * компонентом нельзя: единственный способ — iframe с того же домена.
 *
 * `allow-same-origin` оставлен осознанно: игра — наш собственный код, а
 * STILL ROAD складывает прогресс в localStorage (на opaque-origin он молча
 * не сохраняется). Внешний HTML в эту папку класть нельзя.
 */
export function GameEmbed({ slug, title, aspectRatio }: GameEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  /**
   * Разметка приходит с сервера: если игра успела загрузиться до гидратации,
   * `load` уже не сработает и заглушка осталась бы навсегда. Проверяем готовность
   * документа в момент подключения узла — позже это уже сделает `onLoad`.
   */
  const attachFrame = useCallback((node: HTMLIFrameElement | null) => {
    if (!node) return
    try {
      if (node.contentDocument?.readyState === 'complete') setIsLoaded(true)
    } catch {
      // Чужой кадр сюда попасть не должен, но падать из-за проверки незачем.
    }
  }, [])

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen()
      else await container.requestFullscreen()
    } catch {
      // Браузер может запретить fullscreen (например, в iOS Safari) — игра
      // остаётся играбельной в обычном окне.
    }
  }, [])

  const isHorizontal = HORIZONTAL_FRAMES.includes(aspectRatio)

  return (
    <div className="mt-4">
      {isHorizontal ? (
        <p className="mb-3 hidden text-[11px] leading-relaxed text-cf-text-3 portrait:block lg:portrait:hidden">
          Кадр горизонтальный — разверните телефон или откройте игру на весь экран.
        </p>
      ) : null}

      <div
        ref={containerRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
            : 'cf-cabinet rounded-2xl p-2 md:p-3'
        }
      >
        <div
          className={cn(
            'relative overflow-hidden bg-black',
            isFullscreen ? 'h-full w-full' : cn('w-full rounded-[10px]', FRAME[aspectRatio]),
          )}
        >
          <iframe
            ref={attachFrame}
            src={`/games/${slug}/index.html`}
            title={title}
            onLoad={() => setIsLoaded(true)}
            className="h-full w-full border-0 bg-black"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock"
            allow="fullscreen; autoplay; gamepad"
            allowFullScreen
          />
          {/* Заглушка только до первой отрисовки: игра грузится сама и не
              сообщает о прогрессе, поэтому обещать проценты нечестно. */}
          {isLoaded ? null : (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/40"
            >
              загружаем игру
            </span>
          )}
        </div>
      </div>

      <p role="status" className="sr-only">
        {isLoaded ? `Игра «${title}» загружена` : 'Игра загружается'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-cf-text-1/10 pt-4">
        <button type="button" onClick={toggleFullscreen} className={ACTION_CLASS}>
          {isFullscreen ? (
            <Minimize2 aria-hidden className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 aria-hidden className="h-3.5 w-3.5" />
          )}
          {isFullscreen ? 'Выйти из полного экрана' : 'На весь экран'}
        </button>

        <a
          href={`/games/${slug}/index.html`}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION_CLASS}
        >
          <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          Открыть отдельно
        </a>

      </div>
    </div>
  )
}
