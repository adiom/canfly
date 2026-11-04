'use client'
import { useEffect, type RefObject } from 'react'
import type { ChapterHighlight, ChapterEditorialNote } from '@/lib/releases-types'
import { indexReaderText, readerRange } from './highlight-anchor'

export function useHighlightRanges(rootRef: RefObject<HTMLDivElement | null>, highlights: ChapterHighlight[], notes: ChapterEditorialNote[],
  onHighlight: (h: ChapterHighlight) => void, onNote: (n: ChapterEditorialNote) => void, mounted = true) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || !mounted) return
    const entries: { name: string; range: Range; item: ChapterHighlight | ChapterEditorialNote; editorial: boolean }[] = []
    const indexed = indexReaderText(root)
    for (const item of [...highlights, ...notes]) {
      const editorial = 'author_id' in item
      const anchor = !editorial && item.anchor ? item.anchor : { exact: item.text_content, prefix: item.context_before ?? '', suffix: item.context_after ?? '', start: item.start_offset ?? -1, end: item.end_offset ?? -1 }
      const range = readerRange(root, anchor, indexed)
      if (range) entries.push({ name: 'cf_' + item.id.replaceAll('-', '_'), range, item, editorial })
    }
    const style = document.createElement('style')
    style.textContent = entries.map(e => `::highlight(${e.name}) { background-color: ${e.editorial ? '#e9731644' : '#d5252533'}; }`).join('\n')
    document.head.appendChild(style)
    if ('highlights' in CSS && typeof Highlight !== 'undefined') {
      for (const e of entries) CSS.highlights.set(e.name, new Highlight(e.range))
    }
    const click = (event: MouseEvent) => {
      if (!window.getSelection()?.isCollapsed) return
      const hit = entries.find(e => Array.from(e.range.getClientRects()).some(r => event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom))
      if (hit) {
        if (hit.editorial) onNote(hit.item as ChapterEditorialNote)
        else onHighlight(hit.item as ChapterHighlight)
      }
    }
    root.addEventListener('click', click)
    return () => {
      root.removeEventListener('click', click); style.remove()
      if ('highlights' in CSS) for (const e of entries) CSS.highlights.delete(e.name)
    }
  }, [rootRef, highlights, notes, onHighlight, onNote, mounted])
}
