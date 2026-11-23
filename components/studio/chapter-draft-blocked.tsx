'use client'

import { AlertTriangle, Copy, RefreshCw, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChapterDraft } from '@/lib/studio/chapter-drafts'

/**
 * Показывается, когда серверная версия уже изменилась, но сохранить локальный
 * черновик в браузере не удалось (например, переполнено хранилище). Текст
 * остаётся в редакторе только для чтения, пока пользователь не скопирует его
 * или явно не загрузит серверную версию.
 */
export function ChapterDraftBlocked({
  draft,
  onCopy,
  onRetry,
  onLoadServer,
}: {
  draft: ChapterDraft
  onCopy: () => void
  onRetry: () => void
  onLoadServer: () => void
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 md:px-8 pt-4" role="alert">
      <div className="rounded-2xl border border-cf-accent/50 bg-cf-accent/10 p-4 text-sm text-cf-text-2">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-cf-accent" />
          <div className="min-w-0 flex-1 space-y-3">
            <p>
              Хранилище браузера переполнено, поэтому черновик не сохранён. Редактор
              остаётся только для чтения, чтобы не потерять текст. Скопируйте его
              или повторите сохранение после очистки места.
            </p>
            <textarea
              aria-label="Текст несохранённого черновика"
              readOnly
              value={draft.content}
              className="min-h-24 w-full rounded-lg border border-cf-text-1/20 bg-cf-bg p-2 font-mono text-xs text-cf-text-1"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onCopy}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Скопировать текст
              </Button>
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Повторить сохранение черновика
              </Button>
              <Button size="sm" variant="ghost" onClick={onLoadServer}>
                <Server className="mr-1.5 h-3.5 w-3.5" />
                Загрузить серверную версию
              </Button>
            </div>
            <p className="text-xs text-cf-text-3">
              «Загрузить серверную версию» заменит текст в редакторе. Сначала скопируйте черновик.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
