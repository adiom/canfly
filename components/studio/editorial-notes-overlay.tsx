'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChapterEditorialNote } from '@/lib/releases-types'

interface EditorialNotesOverlayProps {
  editorContainer: HTMLDivElement | null
  notes: ChapterEditorialNote[]
}

interface Indicator {
  id: string
  top: number
  height: number
  status: ChapterEditorialNote['status']
  count: number
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

export function EditorialNotesOverlay({ editorContainer, notes }: EditorialNotesOverlayProps) {
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const rafRef = useRef<number | null>(null)

  const compute = useCallback(() => {
    if (!editorContainer) return

    const proseMirror = editorContainer.querySelector('.ProseMirror')
    if (!proseMirror) return

    const paragraphs: HTMLElement[] = []
    const walker = document.createTreeWalker(proseMirror, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_REJECT
        const tag = node.tagName.toLowerCase()
        if (['p', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) {
          return NodeFilter.FILTER_ACCEPT
        }
        return NodeFilter.FILTER_SKIP
      },
    })
    let n: Node | null = walker.nextNode()
    while (n) {
      paragraphs.push(n as HTMLElement)
      n = walker.nextNode()
    }

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

  useEffect(() => {
    const handler = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(compute)
    }
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [compute])

  if (!editorContainer || indicators.length === 0) return null

  const statusColors: Record<string, string> = {
    open: '#e97316',
    resolved: '#16a34a',
    ignored: '#6b7280',
  }

  return (
    <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden">
      {indicators.map(ind => (
        <div
          key={ind.id}
          className="absolute left-0 pointer-events-auto"
          style={{
            top: `${ind.top}px`,
            height: `${ind.height}px`,
            width: '3px',
            backgroundColor: statusColors[ind.status] ?? '#e97316',
            borderRadius: '1px',
            opacity: ind.status === 'open' ? 0.8 : 0.4,
          }}
        >
          {ind.count > 1 && (
            <span
              className="absolute -top-3 -left-1 text-[9px] font-bold leading-none rounded px-1"
              style={{ backgroundColor: statusColors[ind.status], color: 'white' }}
            >
              {ind.count}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}