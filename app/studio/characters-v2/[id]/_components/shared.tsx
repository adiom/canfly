import type { ReactNode } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'

import { Label } from '@/components/ui/label'
import type { SaveStatus } from './use-autosave'

/**
 * Общие мелочи для узлов v2: индикатор статуса автосохранения и подпись поля.
 * Вынесены отдельно, чтобы каждый узел не дублировал их.
 */

export function StatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
      {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-[#A78BFA]" />}
      {status === 'saved' && <Check className="h-3 w-3 text-emerald-500" />}
      {status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
      {status === 'saving' && 'сохраняю'}
      {status === 'saved' && 'сохранено'}
      {status === 'error' && 'ошибка'}
    </span>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
    </div>
  )
}

/** Общий класс для инпутов/текстареа узла — orbital hairline + violet focus. */
export const inputClass =
  'rounded-xl border-neutral-200 bg-white/70 focus-visible:ring-2 focus-visible:ring-[#A78BFA]/40 focus-visible:border-[#A78BFA]/60'
