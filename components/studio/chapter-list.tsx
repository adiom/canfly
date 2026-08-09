'use client'

import Link from 'next/link'
import { useRef, useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Chapter } from '@/lib/releases-types'
import { reorderChaptersAction } from '@/lib/actions/studio'
import { Badge } from '@/components/ui/badge'
import { FileText, GripVertical } from 'lucide-react'

const statusBadgeStyles: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-600 border-amber-200/80',
  published: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
}

export function ChapterList({ chapters, editionId }: { chapters: Chapter[]; editionId: string }) {
  const router = useRouter()
  const [items, setItems] = useState(() => chapters)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const dragIndexRef = useRef<number | null>(null)

  async function commitOrder(newItems: Chapter[]) {
    if (isSaving) return
    setIsSaving(true)
    try {
      await reorderChaptersAction(editionId, newItems.map(chapter => chapter.id))
      router.refresh()
    } catch (error) {
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index
    setDraggedIndex(index)
  }

  function handleDragOver(event: DragEvent<HTMLAnchorElement>, index: number) {
    event.preventDefault()
    const currentIndex = dragIndexRef.current
    if (currentIndex === null || currentIndex === index) return

    const updated = [...items]
    const [dragged] = updated.splice(currentIndex, 1)
    updated.splice(index, 0, dragged)
    dragIndexRef.current = index
    setItems(updated)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    dragIndexRef.current = null
    setDraggedIndex(null)
    commitOrder(items)
  }

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 divide-y divide-white/70">
      {items.map((chapter, index) => (
        <Link
          key={chapter.id}
          href={`/studio/editions/${editionId}/chapters/${chapter.id}`}
          draggable={!isSaving}
          onDragStart={() => handleDragStart(index)}
          onDragOver={event => handleDragOver(event, index)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:bg-violet-50/40 ${draggedIndex === index ? 'opacity-60 bg-violet-50/60' : ''}`}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-gray-300 cursor-grab" />
          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 font-medium text-gray-900">{chapter.title}</span>
          <span className="text-xs text-gray-400">
            {chapter.word_count} сл.
          </span>
          <Badge variant="outline" className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${statusBadgeStyles[chapter.status]}`}>
            {chapter.status === 'published' ? 'Опубликована' : 'Черновик'}
          </Badge>
        </Link>
      ))}
    </div>
  )
}