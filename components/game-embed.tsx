'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react'

import type { GameAspectRatio } from '@/lib/releases-types'

const ASPECT_RATIO_CLASS: Record<GameAspectRatio, string> = {
  '16:9': 'aspect-[16/9]',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '9:16': 'aspect-[9/16]',
}

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

  return (
    <div className="mt-10">
      <div
        ref={containerRef}
        className={
          isFullscreen
            ? 'flex h-screen w-screen items-center justify-center bg-black'
            : `relative w-full overflow-hidden rounded-3xl border border-cf-text-1/10 bg-black shadow-[var(--cf-air-shadow)] ${ASPECT_RATIO_CLASS[aspectRatio]}`
        }
      >
        <iframe
          src={`/games/${slug}/index.html`}
          title={title}
          className="h-full w-full border-0 bg-black"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock"
          allow="fullscreen; autoplay; gamepad"
          allowFullScreen
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex items-center gap-2 rounded-full bg-cf-air-surface px-4 py-2 text-[13px] text-cf-text-2 backdrop-blur-xl transition-colors hover:bg-cf-air-surface-2 hover:text-cf-text-heading"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFullscreen ? 'Выйти из полного экрана' : 'На весь экран'}
        </button>
        <a
          href={`/games/${slug}/index.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-cf-air-surface px-4 py-2 text-[13px] text-cf-text-2 backdrop-blur-xl transition-colors hover:bg-cf-air-surface-2 hover:text-cf-text-heading"
        >
          <ExternalLink className="h-4 w-4" />
          Открыть отдельно
        </a>
      </div>
    </div>
  )
}
