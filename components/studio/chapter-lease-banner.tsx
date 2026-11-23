'use client'

import { AlertCircle, Lock, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChapterLeaseState } from '@/lib/studio/chapter-lease'

/**
 * Статус эксклюзивного редактирования. Пока lease не наш, редактор остаётся
 * только для чтения: текст не теряется, локальные черновики продолжают жить
 * в sessionStorage/архиве.
 */
export function ChapterLeaseBanner({ state, onRetry }: {
  state: ChapterLeaseState
  onRetry: () => void
}) {
  if (state.status === 'active' && !state.degraded) return null

  const box = 'mx-auto max-w-4xl px-4 md:px-8 pt-4'
  const base = 'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm'

  if (state.status === 'acquiring' || state.status === 'recovering') {
    return (
      <div className={box} aria-live="polite">
        <div className={`${base} border-cf-text-1/10 bg-cf-bg-2 text-cf-text-3`}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {state.status === 'acquiring'
            ? 'Проверяю право редактирования главы…'
            : 'Восстанавливаю право редактирования…'}
        </div>
      </div>
    )
  }

  if (state.status === 'active') {
    return (
      <div className={box} role="alert">
        <div className={`${base} border-cf-status-open/40 bg-cf-status-open/10 text-cf-text-2`}>
          <WifiOff className="h-4 w-4 text-cf-status-open" />
          Нет связи с сервером. Блокировка продлевается автоматически; правки сохранятся локально.
        </div>
      </div>
    )
  }

  if (state.status === 'lost') {
    return (
      <div className={box} role="alert">
        <div className={`${base} border-cf-accent/40 bg-cf-accent/10 text-cf-text-2`}>
          <AlertCircle className="h-4 w-4 shrink-0 text-cf-accent" />
          <span className="flex-1">
            Право редактирования потеряно: главу открыли в другой сессии или истекло время ожидания.
            Ваш текст сохранён в локальных черновиках и не удалён.
          </span>
          <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={box} role="alert">
        <div className={`${base} border-cf-accent/40 bg-cf-accent/10 text-cf-text-2`}>
          <AlertCircle className="h-4 w-4 shrink-0 text-cf-accent" />
          <span className="flex-1">{state.message}. Редактор открыт только для чтения.</span>
          <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={box} role="alert">
      <div className={`${base} border-cf-text-1/10 bg-cf-bg-2 text-cf-text-2`}>
        <Lock className="h-4 w-4 shrink-0 text-cf-text-3" />
        <span className="flex-1">
          Глава уже редактируется{state.holder ? `: ${state.holder.displayName}` : ''}.
          Режим только для чтения — чужие правки не перезаписываются.
        </span>
        <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Попробовать снова
        </Button>
      </div>
    </div>
  )
}
