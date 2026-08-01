'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ChapterEditorialNote, EditorialNoteStatus } from '@/lib/releases-types'

/** Позиционирование выделения — общая часть SelectionData обеих читалок. */
export interface EditorialSelection {
  text: string
  paragraphIndex: number
  contextBefore: string
  contextAfter: string
}

interface UseEditorialNotesOptions {
  /** Текущая глава; при смене подгружаются её правки. */
  chapterId: string | undefined
  /** Загружать и мутировать только для editor/admin. */
  enabled: boolean
}

/**
 * Редакторские правки главы: загрузка при смене главы, создание из выделения,
 * смена статуса и удаление. Общий слой для обеих читалок
 * (`release-book-reader` и `spread-reader`).
 */
export function useEditorialNotes({ chapterId, enabled }: UseEditorialNotesOptions) {
  const [notes, setNotes] = useState<ChapterEditorialNote[]>([])
  const [activeNote, setActiveNote] = useState<ChapterEditorialNote | null>(null)
  // Главы, для которых запрос уже уходил — чтобы не тянуть повторно и не
  // держать `notes` в зависимостях эффекта.
  const loadedChapters = useRef<Set<string>>(new Set())

  const chapterNotes = useMemo(
    () => (chapterId ? notes.filter(n => n.chapter_id === chapterId) : []),
    [notes, chapterId],
  )

  const openCount = useMemo(
    () => chapterNotes.filter(n => n.status === 'open').length,
    [chapterNotes],
  )

  useEffect(() => {
    if (!chapterId || !enabled) return
    if (loadedChapters.current.has(chapterId)) return
    loadedChapters.current.add(chapterId)

    let cancelled = false
    fetch(`/api/chapter-editorial-notes?chapterId=${chapterId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.data) return
        setNotes(prev => {
          const ids = new Set(prev.map(n => n.id))
          return [...prev, ...(data.data as ChapterEditorialNote[]).filter(n => !ids.has(n.id))]
        })
      })
      .catch(() => {
        loadedChapters.current.delete(chapterId)
      })
    return () => { cancelled = true }
  }, [chapterId, enabled])

  const createNote = useCallback(
    async (selection: EditorialSelection, noteText: string): Promise<boolean> => {
      if (!chapterId) return false
      const res = await fetch('/api/chapter-editorial-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_id: chapterId,
          text_content: selection.text,
          paragraph_index: selection.paragraphIndex,
          context_before: selection.contextBefore,
          context_after: selection.contextAfter,
          note: noteText,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.data) {
        setNotes(prev => [data.data as ChapterEditorialNote, ...prev])
        toast.success('Замечание отправлено')
        return true
      }
      toast.error(data?.error ?? 'Ошибка сохранения')
      return false
    },
    [chapterId],
  )

  const updateStatus = useCallback(async (id: string, status: EditorialNoteStatus) => {
    const res = await fetch(`/api/chapter-editorial-notes/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast.error('Ошибка')
      return
    }
    const data = await res.json()
    const updated = data.data as ChapterEditorialNote
    setNotes(prev => prev.map(n => (n.id === id ? updated : n)))
    setActiveNote(prev => (prev?.id === id ? updated : prev))
    toast.success(
      status === 'resolved' ? 'Замечание решено'
        : status === 'ignored' ? 'Замечание проигнорировано'
        : 'Замечание снова открыто',
    )
  }, [])

  const deleteNote = useCallback(async (id: string) => {
    const res = await fetch(`/api/chapter-editorial-notes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? 'Не удалось удалить замечание')
      return
    }
    setNotes(prev => prev.filter(n => n.id !== id))
    setActiveNote(prev => (prev?.id === id ? null : prev))
    toast.success('Замечание удалено')
  }, [])

  return {
    notes,
    setNotes,
    chapterNotes,
    openCount,
    activeNote,
    setActiveNote,
    createNote,
    updateStatus,
    deleteNote,
  }
}
