'use client'

import { useState } from 'react'
import type { CoreWeek } from '@/lib/server/user-profile'
import type { SignatureTheme } from '@/lib/user-signature'

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatRange(weekStart: string): string {
  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`
}

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'цитата'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'цитаты'
  return 'цитат'
}

/**
 * Керн — разрез чтения за год. Не столбики: плотность недели передаётся
 * насыщенностью слоя, как в осадочной породе. Пустая неделя — пустая порода,
 * а не «провал» в графике.
 */
export function CoreSample({ weeks, theme }: { weeks: CoreWeek[]; theme: SignatureTheme }) {
  const [active, setActive] = useState<number | null>(null)
  const hex = theme.color.hex
  const max = Math.max(1, ...weeks.map(w => w.quotes))
  const total = weeks.reduce((sum, w) => sum + w.quotes, 0)

  // Подписи месяцев ставим на первую неделю каждого месяца
  const labels = weeks.map((w, i) => {
    const month = new Date(w.week_start).getMonth()
    const prev = i > 0 ? new Date(weeks[i - 1].week_start).getMonth() : -1
    return month !== prev ? MONTHS[month] : null
  })

  return (
    <section className="border-b border-cf-text-1/10 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
            Керн · разрез чтения
          </h2>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
            {total} {plural(total)} · 52 недели
          </p>
        </div>

        <div className="mt-5 flex h-16 gap-px" role="img" aria-label={`Цитаты по неделям за год: всего ${total}`}>
          {weeks.map((week, i) => {
            const density = week.quotes === 0 ? 0 : 0.18 + (week.quotes / max) * 0.82
            return (
              <button
                key={week.week_start}
                type="button"
                aria-label={`${formatRange(week.week_start)}: ${week.quotes} ${plural(week.quotes)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex-1 outline-none"
              >
                <span
                  className="block h-full w-full transition-[background-color] duration-200"
                  style={{
                    backgroundColor:
                      density === 0
                        ? 'color-mix(in srgb, var(--cf-text-1) 7%, transparent)'
                        : `color-mix(in srgb, ${hex} ${Math.round(density * 100)}%, transparent)`,
                    outline: active === i ? '1px solid var(--cf-text-1)' : 'none',
                  }}
                />
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex gap-px" aria-hidden>
          {labels.map((label, i) => (
            <span
              key={i}
              className="flex-1 font-mono text-[8px] uppercase tracking-[0.14em] text-cf-text-4"
            >
              {label}
            </span>
          ))}
        </div>

        <p className="mt-3 h-4 font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-3">
          {active !== null
            ? `${formatRange(weeks[active].week_start)} · ${weeks[active].quotes} ${plural(weeks[active].quotes)}`
            : ''}
        </p>
      </div>
    </section>
  )
}
