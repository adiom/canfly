import * as React from 'react'
import { cn } from '@/lib/utils'

export type ChipTone = 'accent' | 'on' | 'slow' | 'quiet' | 'warm'

const TONE_BG: Record<ChipTone, string> = {
  accent: 'bg-cf-air-accent/12 text-cf-air-accent-ink',
  on: 'bg-cf-live-on/14 text-cf-live-on',
  slow: 'bg-cf-live-slow/14 text-cf-live-slow',
  quiet: 'bg-cf-text-4/14 text-cf-text-3',
  warm: 'bg-cf-warm/14 text-cf-warm',
}

/**
 * Маленькая пилюля для меток состояний: «Союзник», «Живёт», «Принят».
 * Используется в новых блоках Studio (связи, читатели), а в будущем —
 * для постепенной миграции бейджей из `bg-violet-50/600`.
 *
 * Тон подтягивает и фон, и цвет текста из `cf-air-*`/`cf-live-*`,
 * чтобы выдержать правило: «метка обязана проходить AA» (см.
 * docs/design-system.md, раздел «Воздушный слой»).
 */
export const GlassChip = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    tone?: ChipTone
  }
>(function GlassChip({ tone = 'quiet', className, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[10px] font-medium uppercase tracking-[0.2em]',
        'backdrop-blur-md',
        TONE_BG[tone],
        className,
      )}
      {...props}
    />
  )
})
