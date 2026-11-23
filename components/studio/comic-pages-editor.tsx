'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus, Trash2, Check, Loader2 } from 'lucide-react'
import type { Chapter } from '@/lib/releases-types'
import { AutosaveQueue } from '@/lib/studio/autosave-queue'
import type { ChapterWriteResult } from '@/lib/studio/chapter-write'
import {
  loadMediaDraft,
  isMemoryMediaDraft,
  removeMediaDraft,
  storeMediaDraft,
  type MediaDraft,
  type MediaDraftInput,
} from '@/lib/studio/media-drafts'

interface ComicPagesEditorProps {
  initialPages: string[]
  savePages: (pages: string[]) => Promise<ChapterWriteResult<Chapter>>
  getRevision: () => number
  readOnly?: boolean
  accessRevoked?: boolean
  onLocalDraft?: (draft: MediaDraftInput | null, saved?: boolean) => void
  onUploadPending?: (pending: boolean) => void
  draftOwner: string
  chapterId: string
  chapterRevision: number
}

export function ComicPagesEditor({
  initialPages,
  savePages,
  getRevision,
  readOnly = false,
  accessRevoked = false,
  onLocalDraft,
  onUploadPending,
  draftOwner,
  chapterId,
  chapterRevision,
}: ComicPagesEditorProps) {
  const [pages, setPages] = useState<string[]>(initialPages)
  const [uploading, setUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [revision, setRevision] = useState(chapterRevision)
  const ownDraft = useRef<number | undefined>(undefined)
  const [queue] = useState(() => new AutosaveQueue({ pages: initialPages }, async ({ pages }) => {
    const result = await savePages(pages)
    if (!result.ok) {
      toast.error(result.message)
      setSaveError(result.message)
      throw new Error(result.message)
    }
    setRevision(result.value.revision)
    setSaveError(null)
  }))
  const status = useSyncExternalStore(queue.subscribe, queue.getStatus, () => 'saved' as const)
  const isPending = status === 'pending' || status === 'saving'
  const wasReadOnly = useRef(readOnly)
  const [recovery, setRecovery] = useState<MediaDraft | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const editingDisabled = readOnly || !draftLoaded || !!recovery || uploading

  const recordDraft = useCallback((content: string, baseRevision: number) => {
    const draft: MediaDraftInput = {
      kind: 'comic',
      chapterId,
      userId: draftOwner,
      baseRevision,
      title: 'Комикс',
      content,
    }
    const stored = storeMediaDraft(draft)
    ownDraft.current = stored.draft.savedAt
    onLocalDraft?.(draft, stored.persisted)
    return stored.persisted
  }, [chapterId, draftOwner, onLocalDraft])

  useEffect(() => {
    // Читаем хранилище после гидратации, чтобы SSR и клиент совпадали.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage недоступен на сервере
    setRecovery(loadMediaDraft('comic', draftOwner, chapterId))
    setDraftLoaded(true)
  }, [chapterId, draftOwner])

  useEffect(() => {
    if (!draftLoaded || recovery) {
      const memoryDraft = recovery && isMemoryMediaDraft(recovery) ? recovery : null
      onLocalDraft?.(memoryDraft, !memoryDraft)
      return
    }
    const content = JSON.stringify(pages)
    if (!queue.isDirty() && content === JSON.stringify(queue.getSavedValue().pages)) {
      onLocalDraft?.(null)
      if (ownDraft.current !== undefined) {
        removeMediaDraft('comic', draftOwner, chapterId, ownDraft.current)
        ownDraft.current = undefined
      }
      return
    }
    if (!recordDraft(content, revision)) {
      toast.error('Не удалось сохранить локальный черновик: хранилище переполнено')
    }
  }, [chapterId, draftLoaded, draftOwner, onLocalDraft, pages, queue, recordDraft, recovery, revision, status])

  useEffect(() => {
    // Возврат lease при неизменной ревизии: повторяем грязную очередь.
    if (wasReadOnly.current && !readOnly) void queue.flush().catch(() => {})
    wasReadOnly.current = readOnly
  }, [queue, readOnly])

  function restoreDraft() {
    if (!recovery || readOnly) return
    try {
      const parsed = JSON.parse(recovery.content) as unknown
      if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
        throw new Error('invalid')
      }
      setPages(parsed)
      queue.update({ pages: parsed })
      ownDraft.current = recovery.savedAt
      setRecovery(null)
      setSaveError(null)
      toast.success('Локальный черновик комикса восстановлен')
    } catch {
      toast.error('Черновик комикса повреждён')
    }
  }

  function discardDraft() {
    if (recovery) removeMediaDraft('comic', draftOwner, chapterId, recovery.savedAt)
    setRecovery(null)
  }

  function persist(newPages: string[]) {
    queue.update({ pages: newPages })
    // Загрузка может завершиться уже после внутрисайтового Back.
    if (queue.isDirty()) recordDraft(JSON.stringify(newPages), getRevision())
    void queue.flush().catch(() => {})
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (editingDisabled) return
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    onUploadPending?.(true)
    let uploaded = 0

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/studio/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Failed to upload ${file.name}: ${errorData.error || res.statusText}`)
        }

        const data = await res.json()
        const newPages = [...queue.getValue().pages, data.url]
        setPages(newPages)
        persist(newPages)
        uploaded++
      }

      toast.success(`Загружено ${uploaded} страниц`)
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setUploading(false)
      onUploadPending?.(false)
      e.target.value = ''
    }
  }

  function handleAddByUrl() {
    if (editingDisabled) return
    const url = window.prompt('URL изображения:')
    if (url) {
      const newPages = [...pages, url]
      setPages(newPages)
      persist(newPages)
    }
  }

  function handleDelete(index: number) {
    if (editingDisabled) return
    const newPages = pages.filter((_, i) => i !== index)
    setPages(newPages)
    persist(newPages)
    toast.success('Страница удалена')
  }

  function handleDragStart(index: number) {
    if (editingDisabled) return
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (editingDisabled || draggedIndex === null || draggedIndex === index) return

    const newPages = [...pages]
    const draggedItem = newPages[draggedIndex]
    newPages.splice(draggedIndex, 1)
    newPages.splice(index, 0, draggedItem)

    setPages(newPages)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    if (!editingDisabled && draggedIndex !== null) {
      persist(pages)
    }
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-4">
      {recovery && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Найден локальный черновик комикса</p>
          <p className="mt-1 text-xs">
            Сохранён {new Date(recovery.savedAt).toLocaleString('ru-RU')}, ревизия {recovery.baseRevision}.
            {recovery.baseRevision !== chapterRevision && ' Глава изменилась: восстановление заменит текущие страницы.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={readOnly} onClick={restoreDraft}>
              Восстановить страницы
            </Button>
            <Button size="sm" variant="ghost" onClick={discardDraft}>
              Удалить черновик
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Страницы комикса ({pages.length})</h3>
          {!accessRevoked && <span className="text-xs text-muted-foreground">
            {isPending && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
            {!recovery && status === 'saved' && !saveError && <Check className="inline h-3 w-3 text-emerald-500 mr-1" />}
            {isPending && 'Сохраняю...'}
            {recovery && 'Есть локальный черновик'}
            {!recovery && status === 'saved' && !saveError && 'Сохранено'}
            {saveError || (status === 'error' && 'Ошибка сохранения')}
          </span>}
        </div>
        <div className="flex gap-2">
          {status === 'error' && !recovery && (
            <Button variant="outline" size="sm" disabled={editingDisabled} onClick={() => void queue.flush().catch(() => {})}>
              Повторить сохранение
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleAddByUrl} disabled={editingDisabled}>
            + URL
          </Button>
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={editingDisabled}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={editingDisabled}
              onClick={e => {
                e.preventDefault()
                const input = e.currentTarget.previousElementSibling as HTMLInputElement | null
                if (input) input.click()
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              {uploading ? 'Загрузка...' : 'Загрузить'}
            </Button>
          </label>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-16 text-center">
          <p className="text-gray-400">Страницы не добавлены. Загрузите изображения или добавьте по URL.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {pages.map((url, index) => (
            <div
              key={`${url}-${index}`}
              draggable={!editingDisabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group rounded-xl overflow-hidden border border-white/70 shadow-sm ${
                readOnly ? 'cursor-default' : 'cursor-move'
              } ${draggedIndex === index ? 'opacity-50' : ''}`}
            >
              <div className="relative aspect-[3/4] bg-muted">
                <Image
                  src={url}
                  alt={`Страница ${index + 1}`}
                  fill
                  sizes="200px"
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs text-white font-medium mr-2">{index + 1}</span>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  disabled={editingDisabled}
                  onClick={() => handleDelete(index)}
                  aria-label={`Удалить страницу ${index + 1}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {readOnly ? 'Режим только для чтения: страницы нельзя менять.' : 'Перетаскивайте карточки для изменения порядка'}
      </p>
    </div>
  )
}
