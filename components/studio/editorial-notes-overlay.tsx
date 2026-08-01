'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChapterEditorialNote } from '@/lib/releases-types'
import { collectParagraphs } from '@/lib/studio/paragraphs'
import { editorialStatusStyle } from '@/lib/studio/editorial-status'

interface EditorialNotesOverlayProps {
  editorContainer: HTMLDivElement | null
  notes: ChapterEditorialNote[]
  /** Клик по индикатору — открыть первую правку группы. */
  onIndicatorClick?: (note: ChapterEditorialNote) => void
}

interface Indicator {
  id: string
  top: number
  height: number
  status: ChapterEditorialNote['status']
  count: number
  note: ChapterEditorialNote
}

function findParagraphForNote(paragraphs: HTMLElement[], note: ChapterEditorialNote): HTMLElement | null {
  if (!note.text_content) return null

  for (const p of paragraphs) {
    const text = p.textContent ?? ''
    if (text.includes(note.text_content)) return p
  }

  if (note.context_before) {
    for (const p of paragraphs) {
      const text = p.textContent ?? ''
      if (text.includes(note.context_before)) return p
    }
  }

  if (note.paragraph_index != null) {
    return paragraphs[note.paragraph_index]
  }

  return null
}

export function EditorialNotesOverlay({ editorContainer, notes, onIndicatorClick }: EditorialNotesOverlayProps) {
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const rafRef = useRef<number | null>(null)

  const compute = useCallback(() => {
    if (!editorContainer) return

    const proseMirror = editorContainer.querySelector('.ProseMirror')
    if (!proseMirror) return

    const paragraphs = collectParagraphs(proseMirror)
    const editorRect = editorContainer.getBoundingClientRect()

    // Группируем по найденному параграфу (HTMLElement)
    const byElement = new Map<HTMLElement, { notes: ChapterEditorialNote[]; firstId: string }>()
    for (const note of notes) {
      const target = findParagraphForNote(paragraphs, note)
      if (!target) continue
      const existing = byElement.get(target)
      if (existing) {
        existing.notes.push(note)
      } else {
        byElement.set(target, { notes: [note], firstId: note.id })
      }
    }

    const result: Indicator[] = []
    for (const [el, group] of byElement) {
      const pRect = el.getBoundingClientRect()
      const top = pRect.top - editorRect.top
      const height = pRect.height
      const status = group.notes.some(n => n.status === 'open') ? 'open' :
                     group.notes.some(n => n.status === 'resolved') ? 'resolved' : 'ignored'
      result.push({
        id: group.firstId,
        top,
        height,
        status,
        count: group.notes.length,
        note: group.notes[0],
      })
    }

    setIndicators(result)
  }, [editorContainer, notes])

  // Пересчёт indicators из DOM-layout (getBoundingClientRect).
  // setState в effect — синхронизация с external DOM-layout.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- compute indicators from DOM layout
    compute()
  }, [compute])

  // Позиции зависят от layout: пересчитываем на resize, scroll и правках текста.
  useEffect(() => {
    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(compute)
    }

    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)

    const proseMirror = editorContainer?.querySelector('.ProseMirror')
    const observer = proseMirror ? new MutationObserver(schedule) : null
    observer?.observe(proseMirror as Node, { childList: true, subtree: true, characterData: true })

    return () => {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      observer?.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [compute, editorContainer])

  if (!editorContainer || indicators.length === 0) return null

  return (
    <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden">
      {indicators.map(ind => (
        <button
          key={ind.id}
          type="button"
          onClick={() => onIndicatorClick?.(ind.note)}
          disabled={!onIndicatorClick}
          aria-label={`Правок в абзаце: ${ind.count}`}
          className="absolute left-0 pointer-events-auto disabled:cursor-default"
          style={{
            top: `${ind.top}px`,
            height: `${ind.height}px`,
            width: '3px',
            backgroundColor: editorialStatusStyle(ind.status).color,
            borderRadius: '1px',
            opacity: ind.status === 'open' ? 0.8 : 0.4,
          }}
        >
          {ind.count > 1 && (
            <span
              className="absolute -top-3 -left-1 text-[9px] font-bold leading-none rounded px-1 text-cf-bg"
              style={{ backgroundColor: editorialStatusStyle(ind.status).color }}
            >
              {ind.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
