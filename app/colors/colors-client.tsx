'use client'

import { useState } from 'react'
import { CANFLY_COLORS, type CanflyColor } from './data'

const SERIF = "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)"
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ColorModal, ColorEntry, PaletteStrip } from './colors-parts'

interface ColorsPageClientProps {
  breadcrumbs: { label: string; url: string }[]
}

export default function ColorsPageClient({ breadcrumbs }: ColorsPageClientProps) {
  const [selectedColor, setSelectedColor] = useState<CanflyColor | null>(null)

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/colors" />
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
        <Breadcrumbs items={breadcrumbs} />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-cf-text-1/10 px-4 pb-16 pt-24 md:px-8 md:pb-20 md:pt-32">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 15% 85%, #d52525, transparent),
                         radial-gradient(ellipse 40% 55% at 80% 15%, #6a9ab8, transparent)`,
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.22em] text-cf-accent">
            Canfly Colors · Коллекция I · 2026
          </p>
          <h1
            className="text-[clamp(3.5rem,11vw,9.5rem)] font-light leading-[0.85] tracking-[-0.03em] text-cf-text-heading"
            style={{ fontFamily: SERIF }}
          >
            Каждый цвет —<br />
            <em className="italic text-cf-accent">отдельная история</em>
          </h1>
          <p
            className="mt-6 max-w-md text-base font-light italic leading-[1.8] text-cf-text-3 md:mt-8 md:text-lg"
            style={{ fontFamily: SERIF }}
          >
            Цвета не называются — они рассказываются. Каждый оттенок несёт имя,
            происхождение и нарратив, уходящий в глубины геологии, биологии и памяти.
          </p>

          <div className="mt-10 flex items-center gap-8 md:gap-12">
            {[
              { num: CANFLY_COLORS.length.toString(), label: 'Цветов' },
              { num: 'I', label: 'Коллекция' },
              { num: '2026', label: 'Год' },
            ].map((stat, i) => (
              <div key={i} className="flex items-baseline gap-6">
                {i > 0 && <span className="h-8 w-px bg-cf-text-1/12" />}
                <div>
                  <p
                    className="text-2xl font-light leading-none text-cf-text-heading"
                    style={{ fontFamily: SERIF }}
                  >
                    {stat.num}
                  </p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-4">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Palette strip */}
      <PaletteStrip onSelect={setSelectedColor} />

      {/* Section label */}
      <div className="flex items-center gap-4 border-b border-cf-text-1/8 px-4 py-3 md:px-8">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
          {CANFLY_COLORS[0].id} — {CANFLY_COLORS[CANFLY_COLORS.length - 1].id}
        </span>
        <span className="h-px flex-1 bg-cf-text-1/6" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
          Первобытное · Земля · Память
        </span>
      </div>

      {/* Color catalog */}
      <div>
        {CANFLY_COLORS.map((color, i) => (
          <ColorEntry
            key={color.id}
            color={color}
            index={i}
            onSelect={setSelectedColor}
          />
        ))}
      </div>

      {/* Grid overview */}
      <section className="border-t border-cf-text-1/8 px-4 py-16 md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
            Полная коллекция · {CANFLY_COLORS.length} цветов
          </p>
          <div className="grid grid-cols-4 gap-0.5 sm:grid-cols-6 md:grid-cols-8">
            {CANFLY_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedColor(c)}
                title={c.name}
                className="group relative aspect-square overflow-hidden transition-transform duration-300 hover:scale-[0.96] hover:z-10"
                style={{ background: c.hex }}
                aria-label={c.name}
              >
                <div
                  className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/50 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                >
                  <p className="font-mono text-[8px] text-white/80 leading-tight">{c.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* Modal */}
      <ColorModal color={selectedColor} onClose={() => setSelectedColor(null)} />
    </main>
  )
}
