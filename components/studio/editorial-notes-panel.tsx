'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Check, X, MessageCircle, RefreshCw, Trash2, RotateCcw } from 'lucide-react'
import type { ChapterEditorialNote, EditorialNoteStatus } from '@/lib/releases-types'
import { closestParagraph, collectParagraphs } from '@/lib/studio/paragraphs'
import { EDITORIAL_STATUS, editorialStatusStyle } from '@/lib/studio/editorial-status'

interface EditorialNotesPanelProps {
  chapterId: string
  onNoteFocus?: (note: ChapterEditorialNote) => void
  editorialNotes?: ChapterEditorialNote[]
  onNotesUpdate?: (notes: ChapterEditorialNote[]) => void
}

export function EditorialNotesPanel({ chapterId, onNoteFocus, editorialNotes: externalNotes, onNotesUpdate }: EditorialNotesPanelProps) {
  const [notes, setNotes] = useState<ChapterEditorialNote[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selection, setSelection] = useState<{ text: string; paragraphIndex: number; contextBefore: string; contextAfter: string } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [filter, setFilter] = useState<EditorialNoteStatus | 'all'>('open')
  const [hasLoaded, setHasLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chapter-editorial-notes?chapterId=${chapterId}`)
      const data = await res.json()
      if (res.ok) {
        const loaded = data.data ?? []
        setNotes(loaded)
        onNotesUpdate?.(loaded)
        setHasLoaded(true)
      }
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [chapterId, onNotesUpdate])

  // Первичная загрузка notes. setState в effect — data-loading паттерн.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/chapter-editorial-notes?chapterId=${chapterId}`)
        const data = await res.json()
        if (cancelled) return
        if (res.ok) {
          const loaded = data.data ?? []
          setNotes(loaded)
          onNotesUpdate?.(loaded)
          setHasLoaded(true)
        }
      } catch {
        if (!cancelled) toast.error('Ошибка загрузки')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [chapterId, onNotesUpdate])

  // Синхронизация с parent notes (после первичной загрузки).
  useEffect(() => {
    if (hasLoaded && externalNotes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with parent state after initial load
      setNotes(externalNotes)
    }
  }, [externalNotes, hasLoaded])

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const text = sel.toString().trim()
    if (text.length < 2) { setSelection(null); return }

    // Считаем только внутри редактора: иначе индекс расходится с оверлеем,
    // который обходит .ProseMirror.
    const root = document.querySelector('.ProseMirror')
    if (!root || !sel.anchorNode || !root.contains(sel.anchorNode)) {
      setSelection(null)
      return
    }

    const paragraphEl = closestParagraph(sel.anchorNode, root)
    if (!paragraphEl) return

    const fullText = paragraphEl.textContent ?? ''
    const offset = fullText.indexOf(text)
    const contextBefore = offset >= 0 ? fullText.slice(Math.max(0, offset - 30), offset) : ''
    const contextAfter = offset >= 0 ? fullText.slice(offset + text.length, offset + text.length + 30) : ''

    const idx = collectParagraphs(root).indexOf(paragraphEl)

    setSelection({ text, paragraphIndex: idx, contextBefore, contextAfter })
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  const createNote = async () => {
    if (!selection || !noteText.trim()) {
      toast.error('Выделите текст и напишите комментарий')
      return
    }
    try {
      const res = await fetch('/api/chapter-editorial-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_id: chapterId,
          client_request_id: crypto.randomUUID(),
          text_content: selection.text,
          paragraph_index: selection.paragraphIndex,
          context_before: selection.contextBefore,
          context_after: selection.contextAfter,
          note: noteText.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.data) {
        const updated = [data.data, ...notes]
        setNotes(updated)
        onNotesUpdate?.(updated)
        toast.success('Правка добавлена')
        setSelection(null)
        setNoteText('')
        setIsCreating(false)
        window.getSelection()?.removeAllRanges()
      } else {
        toast.error(data.error ?? 'Ошибка')
      }
    } catch {
      toast.error('Сетевая ошибка')
    }
  }

  const updateStatus = async (id: string, status: EditorialNoteStatus) => {
    const res = await fetch(`/api/chapter-editorial-notes/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      const updated = notes.map(n => n.id === id ? data.data : n)
      setNotes(updated)
      onNotesUpdate?.(updated)
      toast.success(
        status === 'resolved' ? 'Решено'
          : status === 'ignored' ? 'Проигнорировано'
          : 'Снова открыто',
      )
    } else {
      toast.error('Ошибка')
    }
  }

  const removeNote = async (id: string) => {
    if (!confirm('Удалить правку?')) return
    const res = await fetch(`/api/chapter-editorial-notes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? 'Не удалось удалить правку')
      return
    }
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated)
    onNotesUpdate?.(updated)
    toast.success('Правка удалена')
  }

  const filtered = filter === 'all' ? notes : notes.filter(n => n.status === filter)
  const openCount = notes.filter(n => n.status === 'open').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Правки
          {openCount > 0 && (
            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${EDITORIAL_STATUS.open.badge}`}>{openCount}</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            aria-label="Обновить"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="text-xs bg-transparent border rounded px-2 py-1"
          >
            <option value="open">Открытые</option>
            <option value="resolved">Решённые</option>
            <option value="ignored">Игнорированные</option>
            <option value="all">Все</option>
          </select>
        </div>
      </div>

      {!isCreating ? (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full border border-dashed py-3 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Выделите текст в редакторе и добавьте правку
        </button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          {selection ? (
            <blockquote className="text-xs italic border-l-2 border-current/30 pl-2 line-clamp-3">
              «{selection.text}»
            </blockquote>
          ) : (
            <p className="text-xs text-muted-foreground">Выделите текст в редакторе главы...</p>
          )}
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Ваш комментарий — что нужно исправить..."
            rows={3}
            className="w-full text-sm bg-background border rounded p-2 outline-none focus:border-current"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setIsCreating(false); setSelection(null); setNoteText('') }}
              className="flex-1 h-8 text-xs border hover:bg-muted transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={createNote}
              disabled={!selection || !noteText.trim()}
              className="flex-1 h-8 text-xs bg-foreground text-background disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">
            {filter === 'open' ? 'Нет открытых правок' : 'Правок нет'}
          </p>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              onClick={() => onNoteFocus?.(n)}
              className={`border rounded p-3 space-y-2 cursor-pointer transition-colors ${editorialStatusStyle(n.status).card}`}
            >
              <blockquote className="text-xs italic border-l-2 border-current/30 pl-2 line-clamp-3">
                «{n.text_content}»
              </blockquote>
              <p className="text-sm">{n.note}</p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{n.author_name} · {new Date(n.created_at).toLocaleDateString('ru-RU')}</span>
                <span className="uppercase tracking-wider font-bold">
                  {editorialStatusStyle(n.status).label}
                </span>
              </div>
              {n.status === 'open' && (
                <div className="flex gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => updateStatus(n.id, 'resolved')}
                    className="flex-1 h-7 text-xs bg-cf-status-resolved text-cf-bg hover:opacity-90 flex items-center justify-center gap-1"
                  >
                    <Check className="h-3 w-3" /> Решено
                  </button>
                  <button
                    onClick={() => updateStatus(n.id, 'ignored')}
                    className="flex-1 h-7 text-xs border hover:bg-muted flex items-center justify-center gap-1"
                  >
                    <X className="h-3 w-3" /> Игнорировать
                  </button>
                  <button
                    onClick={() => removeNote(n.id)}
                    className="h-7 w-7 text-xs border hover:bg-muted flex items-center justify-center"
                    aria-label="Удалить правку"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
              {n.status !== 'open' && (
                <div className="flex gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => updateStatus(n.id, 'open')}
                    className="flex-1 h-7 text-xs border hover:bg-muted flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Вернуть в работу
                  </button>
                  <button
                    onClick={() => removeNote(n.id)}
                    className="h-7 w-7 text-xs border hover:bg-muted flex items-center justify-center"
                    aria-label="Удалить правку"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
