'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  listArchivedChapterDrafts, removeArchivedChapterDraft, type ArchivedChapterDraft,
} from '@/lib/studio/chapter-drafts'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export function ChapterDraftRecovery({ prefix, canRestore, onRestore }: {
  prefix: string
  canRestore: boolean
  onRestore: (draft: ArchivedChapterDraft) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<ArchivedChapterDraft[]>([])

  async function copy(content: string) {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('HTML черновика скопирован')
    } catch {
      toast.error('Выделите и скопируйте HTML из поля черновика')
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => {
      if (value) setDrafts(listArchivedChapterDrafts(prefix))
      setOpen(value)
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Локальные черновики</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Локальные черновики</DialogTitle>
          <DialogDescription>
            Восстановление заменяет текущий текст главы. Архивная копия остаётся доступна до удаления.
            {!canRestore && ' Перед восстановлением перезагрузите главу.'}
          </DialogDescription>
        </DialogHeader>
        {drafts.length === 0 && <p className="text-sm text-cf-text-3">Архивных черновиков нет.</p>}
        {drafts.map(draft => (
          <section key={draft.key} className="space-y-2 rounded-xl border border-cf-text-1/10 p-3">
            <h3 className="text-sm font-semibold">{draft.title || 'Без заголовка'}</h3>
            <p className="text-xs text-cf-text-3">
              Ревизия {draft.revision} · {new Date(draft.archivedAt).toLocaleString('ru-RU')}
            </p>
            <textarea
              aria-label="HTML черновика"
              value={draft.content}
              readOnly
              className="min-h-24 w-full rounded-lg border border-cf-text-1/10 p-2 font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copy(draft.content)}>Скопировать HTML</Button>
              <Button size="sm" disabled={!canRestore} onClick={() => {
                if (onRestore(draft)) setOpen(false)
              }}>Восстановить и сохранить текст</Button>
              <Button size="sm" variant="ghost" disabled={!canRestore} onClick={() => {
                removeArchivedChapterDraft(draft.key)
                setDrafts(listArchivedChapterDrafts(prefix))
              }}>Удалить черновик</Button>
            </div>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}
