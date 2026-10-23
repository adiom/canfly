'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ArtworkViewer({
  imageUrl,
  title,
  description,
}: {
  imageUrl: string
  title: string
  description: string | null
}) {
  const viewerRef = useRef<HTMLElement>(null)
  const [scale, setScale] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === viewerRef.current)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === viewerRef.current) {
        await document.exitFullscreen()
      } else {
        await viewerRef.current?.requestFullscreen()
      }
    } catch {
      // Полный экран может быть запрещён браузером или системой.
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-8">
      <header className="mx-auto mb-6 max-w-4xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-cf-text-heading md:text-4xl">{title}</h1>
        {description && <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line text-cf-text-3">{description}</p>}
      </header>

      <section
        ref={viewerRef}
        aria-label={`Картина: ${title}`}
        className={`relative flex items-center justify-center overflow-hidden bg-[#111] p-4 text-white shadow-xl ${
          isFullscreen ? 'h-screen min-h-screen w-screen rounded-none' : 'h-[min(72vh,900px)] min-h-[420px] rounded-2xl'
        }`}
      >
        <div className="absolute right-3 top-3 z-10 flex gap-2 rounded-xl bg-black/60 p-1.5 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hover:text-white" aria-label="Уменьшить" disabled={scale <= 1} onClick={() => setScale(value => Math.max(1, value - 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hover:text-white" aria-label="Увеличить" disabled={scale >= 3} onClick={() => setScale(value => Math.min(3, value + 0.25))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hover:text-white" aria-label={isFullscreen ? 'Выйти из полного экрана' : 'На полный экран'} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
        <Image
          src={imageUrl}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
        />
      </section>
    </main>
  )
}
