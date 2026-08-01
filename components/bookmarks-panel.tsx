'use client'

import { useState } from 'react'
import { X, Trash2, Eye, EyeOff, Heart, ChevronRight, ArrowUpRight, Pencil, Check } from 'lucide-react'
import type { ChapterHighlight } from '@/lib/releases-types'

interface BookmarksPanelProps {
  open: boolean
  onClose: () => void
  highlights: ChapterHighlight[]
  currentChapterId: string
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: { note?: string | null; is_public?: boolean }) => Promise<void>
  onScrollTo: (paragraphIndex: number, chapterId: string) => void
  accent: string
  bg: string
  textColor: string
}

export function BookmarksPanel({
  open,
  onClose,
  highlights,
  currentChapterId,
  onDelete,
  onUpdate,
  onScrollTo,
  accent,
  bg,
  textColor,
}: BookmarksPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const currentChapterHighlights = highlights.filter(h => h.chapter_id === currentChapterId)
  const otherHighlights = highlights.filter(h => h.chapter_id !== currentChapterId)

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить цитату?')) return
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  const handleScrollTo = (h: ChapterHighlight) => {
    onScrollTo(h.paragraph_index ?? 0, h.chapter_id)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[49] transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[340px] flex-col overflow-hidden transition-transform duration-300 ease-out md:w-[380px]"
        style={{
          backgroundColor: bg,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          borderLeft: `1px solid ${textColor}12`,
          boxShadow: open ? `-24px 0 60px rgba(0,0,0,0.5)` : 'none',
        }}
      >
        {/* Верхняя полоса — «переплёт» */}
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />

        {/* Шапка */}
        <div
          className="flex shrink-0 items-end justify-between px-6 pb-4 pt-6"
          style={{ borderBottom: `1px solid ${textColor}0f` }}
        >
          <div>
            <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>
              Пометки
            </p>
            <h2 className="font-[family-name:var(--font-cormorant)] text-3xl italic leading-none" style={{ color: textColor }}>
              {highlights.length === 0
                ? 'Пусто'
                : highlights.length === 1
                ? '1 цитата'
                : `${highlights.length} ${highlights.length >= 2 && highlights.length <= 4 ? 'цитаты' : 'цитат'}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="mb-1 flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-60"
            style={{ backgroundColor: `${textColor}10`, color: textColor }}
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Скроллируемый контент */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
          {highlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
              <div className="relative mb-6 h-24 w-16" aria-hidden>
                <div
                  className="absolute inset-0 rounded-sm"
                  style={{ backgroundColor: `${textColor}08`, border: `1px solid ${textColor}12` }}
                />
                <div
                  className="absolute right-0 top-0 h-6 w-6"
                  style={{ background: `linear-gradient(225deg, ${bg} 50%, ${textColor}12 50%)` }}
                />
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="absolute left-3 right-3 h-px"
                    style={{ top: `${28 + i * 14}px`, backgroundColor: `${textColor}12` }}
                  />
                ))}
              </div>
              <p
                className="font-[family-name:var(--font-cormorant)] text-xl italic leading-relaxed opacity-50"
                style={{ color: textColor }}
              >
                Выделите текст,<br />чтобы оставить пометку
              </p>
            </div>
          ) : (
            <div className="px-4 pt-4">
              {/* === Текущая глава === */}
              {currentChapterHighlights.length > 0 && (
                <section className="mb-6">
                  <p className="mb-3 px-2 text-[9px] font-black uppercase tracking-[0.24em] opacity-40" style={{ color: textColor }}>
                    В этой главе
                  </p>
                  <div className="flex flex-col gap-2">
                    {currentChapterHighlights.map(h => (
                      <BookmarkCard
                        key={h.id}
                        highlight={h}
                        isCurrent
                        isDeleting={deletingId === h.id}
                        accent={accent}
                        bg={bg}
                        textColor={textColor}
                        onScrollTo={() => handleScrollTo(h)}
                        onDelete={() => handleDelete(h.id)}
                        onUpdate={patch => onUpdate(h.id, patch)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* === Другие главы === */}
              {otherHighlights.length > 0 && (
                <section>
                  <p className="mb-3 px-2 text-[9px] font-black uppercase tracking-[0.24em] opacity-40" style={{ color: textColor }}>
                    В других главах
                  </p>
                  <div className="flex flex-col gap-2">
                    {otherHighlights.map(h => (
                      <BookmarkCard
                        key={h.id}
                        highlight={h}
                        isCurrent={false}
                        isDeleting={deletingId === h.id}
                        accent={accent}
                        bg={bg}
                        textColor={textColor}
                        onScrollTo={() => handleScrollTo(h)}
                        onDelete={() => handleDelete(h.id)}
                        onUpdate={patch => onUpdate(h.id, patch)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Нижняя подпись */}
        <div
          className="shrink-0 px-6 py-3 text-center"
          style={{ borderTop: `1px solid ${textColor}0a` }}
        >
          <p className="font-[family-name:var(--font-cormorant)] text-xs italic opacity-25" style={{ color: textColor }}>
            Приватные закладки видны только вам
          </p>
        </div>
      </aside>
    </>
  )
}

function BookmarkCard({
  highlight: h,
  isCurrent,
  isDeleting,
  accent,
  bg,
  textColor,
  onScrollTo,
  onDelete,
  onUpdate,
}: {
  highlight: ChapterHighlight
  isCurrent: boolean
  isDeleting: boolean
  accent: string
  bg: string
  textColor: string
  onScrollTo: () => void
  onDelete: () => void
  onUpdate: (patch: { note?: string | null; is_public?: boolean }) => Promise<void>
}) {
  const [hovered, setHovered] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(h.note ?? '')
  const [saving, setSaving] = useState(false)

  const borderColor = h.is_public ? accent : `${textColor}30`
  const busy = isDeleting || saving

  const togglePublic = async () => {
    setSaving(true)
    try {
      await onUpdate({ is_public: !h.is_public })
    } finally {
      setSaving(false)
    }
  }

  const saveNote = async () => {
    const next = noteDraft.trim()
    if (next === (h.note ?? '')) {
      setEditingNote(false)
      return
    }
    setSaving(true)
    try {
      await onUpdate({ note: next === '' ? null : next })
      setEditingNote(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="group relative overflow-hidden rounded-sm"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        backgroundColor: hovered ? `${textColor}07` : `${textColor}04`,
        transform: hovered ? 'translateX(-2px)' : 'translateX(0)',
        transition: 'all 0.18s ease',
        boxShadow: hovered ? `2px 4px 20px rgba(0,0,0,0.3)` : 'none',
        opacity: busy ? 0.4 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Fold corner */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-5 w-5"
        aria-hidden
        style={{ background: `linear-gradient(225deg, ${bg} 50%, ${textColor}10 50%)` }}
      />

      {/* Цитата — переход к месту в тексте */}
      <button
        className="w-full px-4 pt-3 text-left"
        onClick={onScrollTo}
        disabled={busy}
        aria-label={isCurrent ? 'Перейти к цитате' : 'Перейти к главе с цитатой'}
      >
        {/* Заголовок главы для других глав */}
        {!isCurrent && h.chapter_title && (
          <p
            className="mb-1.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.2em]"
            style={{ color: accent, opacity: 0.7 }}
          >
            <ArrowUpRight className="h-2.5 w-2.5" />
            {h.chapter_title}
          </p>
        )}

        <p
          className="font-[family-name:var(--font-cormorant)] text-[15px] italic leading-snug line-clamp-4"
          style={{ color: textColor }}
        >
          «{h.text_content}»
        </p>
      </button>

      {/* Заметка — просмотр / правка */}
      <div className="px-4">
        {editingNote ? (
          <div className="mt-2">
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Ваша заметка…"
              className="w-full resize-none rounded-sm bg-transparent px-2 py-1.5 text-[11px] leading-snug outline-none"
              style={{ color: textColor, border: `1px solid ${textColor}20` }}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={saveNote}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]"
                style={{ backgroundColor: `${accent}20`, color: accent }}
              >
                <Check className="h-2.5 w-2.5" />
                Сохранить
              </button>
              <button
                onClick={() => { setNoteDraft(h.note ?? ''); setEditingNote(false) }}
                className="text-[9px] font-black uppercase tracking-[0.14em] opacity-40"
                style={{ color: textColor }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          h.note && (
            <p className="mt-2 text-[11px] leading-snug opacity-60 line-clamp-2" style={{ color: textColor }}>
              {h.note}
            </p>
          )
        )}
      </div>

      {/* Метаданные и действия */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-2.5">
        {/* Публичность — тумблер */}
        <button
          onClick={togglePublic}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] transition-opacity hover:opacity-80"
          style={{ color: h.is_public ? accent : `${textColor}35` }}
          aria-pressed={h.is_public}
          title={h.is_public ? 'Сделать приватной' : 'Сделать публичной'}
        >
          {h.is_public ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
          {h.is_public ? 'публичная' : 'приватная'}
        </button>

        {/* Лайки */}
        {h.likes_count > 0 && (
          <span className="inline-flex items-center gap-1 text-[9px] opacity-50" style={{ color: textColor }}>
            <Heart className="h-2.5 w-2.5" />
            {h.likes_count}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Правка заметки */}
          {!editingNote && (
            <button
              onClick={() => setEditingNote(true)}
              disabled={busy}
              className="flex h-6 w-6 items-center justify-center rounded-full transition-opacity"
              style={{ backgroundColor: `${textColor}10`, color: textColor, opacity: hovered ? 0.5 : 0 }}
              aria-label={h.note ? 'Изменить заметку' : 'Добавить заметку'}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}

          {/* Удаление */}
          <button
            onClick={onDelete}
            disabled={busy}
            className="flex h-6 w-6 items-center justify-center rounded-full transition-opacity"
            style={{ backgroundColor: `${textColor}10`, color: textColor, opacity: hovered ? 0.5 : 0 }}
            aria-label="Удалить закладку"
          >
            <Trash2 className="h-3 w-3" />
          </button>

          {/* Стрелка «перейти» */}
          <span
            className="transition-opacity"
            style={{ color: isCurrent ? accent : `${textColor}60`, opacity: hovered ? 0.8 : 0 }}
            aria-hidden
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
}
