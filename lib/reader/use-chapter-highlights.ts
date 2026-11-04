'use client'
import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import type { ChapterHighlight } from '@/lib/releases-types'
export function useChapterHighlights(chapterId: string | undefined, setHighlights: Dispatch<SetStateAction<ChapterHighlight[]>>) {
  useEffect(() => {
    if (!chapterId) return
    const controller = new AbortController()
    fetch(`/api/chapter-highlights?chapterId=${chapterId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => { if (!res.ok) throw new Error(); return res.json() })
      .then(({ data }) => setHighlights(prev => [...prev.filter(h => h.chapter_id !== chapterId), ...data]))
      .catch(error => { if (error.name !== 'AbortError') toast.error('Не удалось загрузить цитаты главы') })
    return () => controller.abort()
  }, [chapterId, setHighlights])
}
