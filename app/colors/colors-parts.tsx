'use client'

import { useCallback, useEffect, useState } from 'react'
import { CANFLY_COLORS, type CanflyColor } from './data'

const SERIF = "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)"

function CopyHex({ hex, className, lightText }: { hex: string; className?: string; lightText?: boolean }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [hex])
  return (
    <button
      onClick={handleCopy}
      className={`cursor-pointer transition-colors hover:text-cf-text-1 ${className ?? ''}`}
      style={lightText !== undefined ? { color: lightText ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' } : undefined}
      title="Скопировать"
    >
      {copied ? 'скопировано' : hex}
    </button>
  )
}

export function PaletteStrip({ onSelect }: { onSelect: (c: CanflyColor) => void }) {
  return (
    <div className="flex h-2 overflow-hidden">
      {CANFLY_COLORS.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          title={c.name}
          className="relative flex-1 cursor-pointer transition-all duration-300 hover:flex-[3]"
          style={{ background: c.hex }}
          aria-label={c.name}
        />
      ))}
    </div>
  )
}

export function ColorModal({
  color,
  onClose,
}: {
  color: CanflyColor | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!color) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [color, onClose])

  if (!color) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="grid w-[min(92vw,860px)] max-h-[88vh] overflow-hidden shadow-2xl md:grid-cols-[260px_1fr]">
        {/* Swatch */}
        <div className="relative min-h-[200px] md:min-h-0" style={{ background: color.hex }}>
          <CopyHex
            hex={color.hex}
            lightText={color.lightText}
            className="absolute bottom-5 left-5 font-mono text-[10px] tracking-[0.1em]"
          />
          <span
            className="absolute top-5 right-5 font-mono text-[9px] tracking-[0.14em]"
            style={{ color: color.lightText ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }}
          >
            {color.id}
          </span>
        </div>

        {/* Body */}
        <div className="relative overflow-y-auto border border-cf-text-1/10 border-l-0 bg-cf-bg-2 p-8">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 border border-cf-text-1/15 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-cf-text-3 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-1"
          >
            × закрыть
          </button>

          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
            {color.category}
          </p>
          <h2
            className="text-5xl font-light leading-[0.9] tracking-[-0.02em] text-cf-text-heading mb-2"
            style={{ fontFamily: SERIF }}
          >
            {color.name}
          </h2>
          <p
            className="mb-6 text-base italic font-light text-cf-text-3"
            style={{ fontFamily: SERIF }}
          >
            &ldquo;{color.fullName}&rdquo; — {color.subtitle}
          </p>

          <div
            className="space-y-4 text-[0.95rem] leading-[1.88] font-light text-cf-text-caption"
            style={{ fontFamily: SERIF }}
          >
            {color.story.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 border-t border-cf-text-1/10 pt-5 font-mono text-[10px] tracking-[0.1em] text-cf-text-4">
            <CopyHex hex={color.hex} className="font-mono text-[10px] tracking-[0.1em]" />
            <span>·</span>
            <span>{color.id}</span>
            <span>·</span>
            <span>{color.era}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ColorEntry({
  color,
  index,
  onSelect,
}: {
  color: CanflyColor
  index: number
  onSelect: (c: CanflyColor) => void
}) {
  const isEven = index % 2 === 0
  const preview = color.story.split('\n\n')[0]

  return (
    <div
      onClick={() => onSelect(color)}
      className={`grid cursor-pointer border-b border-cf-text-1/8 group
        grid-cols-1 md:grid-cols-2
        ${isEven ? '' : 'md:[direction:rtl]'}`}
    >
      {/* Swatch */}
      <div
        className={`relative min-h-[260px] overflow-hidden md:min-h-[420px] ${isEven ? '' : 'md:[direction:ltr]'}`}
      >
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.025]"
          style={{ background: color.hex }}
        />
        <CopyHex
          hex={color.hex}
          lightText={color.lightText}
          className="absolute bottom-5 left-5 font-mono text-[10px] tracking-[0.1em] opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        />
        <span
          className="absolute top-5 right-5 font-mono text-[9px] tracking-[0.14em]"
          style={{ color: color.lightText ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }}
        >
          {color.id}
        </span>
      </div>

      {/* Info */}
      <div
        className={`flex flex-col justify-between bg-cf-bg-2 p-8 md:p-10 ${isEven ? '' : 'md:[direction:ltr]'}`}
      >
        <div>
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
            {color.category}
          </p>
          <h2
            className="mb-2 text-[clamp(2.4rem,4.5vw,3.8rem)] font-light leading-[0.88] tracking-[-0.02em] text-cf-text-heading"
            style={{ fontFamily: SERIF }}
          >
            {color.name}
          </h2>
          <p
            className="mb-5 text-base italic font-light text-cf-text-3"
            style={{ fontFamily: SERIF }}
          >
            &ldquo;{color.fullName}&rdquo; — {color.subtitle}
          </p>
          <p
            className="line-clamp-4 text-[0.92rem] leading-[1.85] font-light text-cf-text-caption"
            style={{ fontFamily: SERIF }}
          >
            {preview}
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-cf-text-1/8 pt-5">
          <div>
            <CopyHex hex={color.hex} className="font-mono text-[10px] tracking-[0.08em] text-cf-text-4" />
            <p className="mt-1 font-mono text-[9px] tracking-[0.06em] text-cf-text-4/60">{color.usedIn}</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="h-5 w-5 rounded-full border border-cf-text-1/15"
              style={{ background: color.hex }}
            />
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-4 transition-colors duration-200 group-hover:text-cf-text-1">
              Читать
              <span className="relative block h-px w-6 bg-current transition-all duration-300 group-hover:w-10">
                <span className="absolute -top-[3px] right-0 block h-[7px] w-[7px] rotate-45 border-r border-t border-current" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
