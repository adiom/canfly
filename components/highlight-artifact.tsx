'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ChapterHighlight } from '@/lib/releases-types'
import type { TextAnchor } from '@/lib/highlights/types'
import { workshopRequest, jsonRequest } from '@/components/highlights/api'
const Workshop = dynamic(() => import('@/components/highlights/workshop').then(m => m.HighlightWorkshopView))
interface HighlightArtifactProps {
  open: boolean; text: string; chapterTitle: string; anchorRect: DOMRect | null
  releaseSlug: string; chapterId: string; paragraphIndex: number
  contextBefore: string; contextAfter: string; startOffset: number; endOffset: number
  anchor?: TextAnchor
  currentUserId: string | null; onSaved: (highlight: ChapterHighlight) => void
  onClose: () => void; accent: string; bg: string; textColor: string
  isEditor: boolean; onSaveEditorial: (note: string) => Promise<void>
}
export function HighlightArtifact(props: HighlightArtifactProps) {
  const [requestId] = useState(() => crypto.randomUUID())
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editorial, setEditorial] = useState('')
  if (!props.open) return null
  if (savedId) return <Workshop id={savedId} onClose={props.onClose} />
  const save = async () => {
    setBusy(true); setError('')
    try {
      const data = await workshopRequest<ChapterHighlight>('/api/chapter-highlights', jsonRequest('POST', {
        chapter_id: props.chapterId, client_request_id: requestId, text_content: props.text,
        paragraph_index: Math.max(0, props.paragraphIndex), context_before: props.contextBefore,
        context_after: props.contextAfter, start_offset: props.startOffset, end_offset: props.endOffset,
        anchor: props.anchor, is_public: false,
      }))
      props.onSaved(data); setSavedId(data.id)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) props.onClose() }}><DialogContent className="bg-cf-bg text-cf-text-1">
    <DialogTitle>Выдели — и твори</DialogTitle>
    <p className="text-sm text-cf-text-3">{props.chapterTitle}</p>
    <blockquote className="max-h-64 overflow-auto border-l-2 border-cf-accent pl-4 font-serif text-xl">«{props.text}»</blockquote>
    <p className="text-sm">Сохраните личный фрагмент. В мастерской можно написать свой текст, создать иллюстрацию и выбрать, что опубликовать.</p>
    {error && <p role="alert" className="text-cf-accent">{error}</p>}
    <Button onClick={() => void save()} disabled={busy || !props.currentUserId || props.text.length > 5000}>{busy ? 'Сохраняется…' : 'Сохранить и открыть мастерскую'}</Button>
    {props.text.length > 5000 && <p>Выделите до 5000 символов.</p>}
    {props.isEditor && <details><summary>Редакторское замечание</summary>
      <textarea aria-label="Что нужно исправить" className="my-3 w-full rounded border bg-transparent p-3" value={editorial} maxLength={2000} onChange={e => setEditorial(e.target.value)} />
      <Button variant="outline" disabled={busy || !editorial.trim()} onClick={async () => {
        setBusy(true)
        try { await props.onSaveEditorial(editorial); props.onClose() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
      }}>Отправить замечание</Button>
    </details>}
  </DialogContent></Dialog>
}
