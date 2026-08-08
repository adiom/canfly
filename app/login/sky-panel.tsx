'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { SKY_COLORS } from '@/lib/canfly-colors'

const HOLD_MS = 8000
const FADE_MS = 1200

const SERIF = "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)"

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/**
 * Флаг `lightText` в коллекции подобран под декоративные подписи на /colors
 * (непрозрачность 0.15–0.4). Здесь штамп нужно читать, поэтому цвет текста
 * считаем по фактической яркости кадра — иначе белым по #66D2F4 не разобрать.
 */
function isDarkHex(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16)
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  return luminance < 0.42
}

const STAMPS = SKY_COLORS.map((color) => {
  const dark = isDarkHex(color.hex)
  return {
    color,
    strong: dark ? 'rgba(255,255,255,0.86)' : 'rgba(0,0,0,0.72)',
    soft: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
  }
})

interface SkyPanelProps {
  /** Стартовый кадр считает сервер: клиент, взявший час сам, разошёлся бы при гидрации. */
  initialIndex: number
  className?: string
}

export function SkyPanel({ initialIndex, className = '' }: SkyPanelProps) {
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % SKY_COLORS.length),
      HOLD_MS,
    )
    return () => clearInterval(timer)
  }, [])

  const active = STAMPS[index]

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {SKY_COLORS.map((color, i) => (
        <div
          key={color.id}
          aria-hidden
          className="absolute inset-0 ease-in-out"
          style={{
            background: color.hex,
            opacity: i === index ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        />
      ))}

      <Link
        href="/colors"
        aria-label="Коллекция цветов canfly"
        className="absolute bottom-6 left-6 grid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current lg:bottom-10 lg:left-10"
        style={{ color: active.strong }}
      >
        {STAMPS.map((stamp, i) => (
          <span
            key={stamp.color.id}
            aria-hidden
            className="col-start-1 row-start-1 block"
            style={{
              opacity: i === index ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease-in-out`,
            }}
          >
            <span
              className="block font-mono text-[10px] uppercase tracking-[0.2em]"
              style={{ color: stamp.strong }}
            >
              {stamp.color.id} · {stamp.color.name}
            </span>
            <span
              className="mt-1.5 block text-lg font-light italic leading-tight"
              style={{ fontFamily: SERIF, color: stamp.strong }}
            >
              «{stamp.color.subtitle.toLowerCase()}»
            </span>
            <span
              className="mt-1.5 block font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ color: stamp.soft }}
            >
              {stamp.color.era}
            </span>
          </span>
        ))}
      </Link>
    </div>
  )
}
