'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { X, Globe, Lock, Check, RotateCcw, Loader2, ImageOff, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { ChapterHighlight } from '@/lib/releases-types'

type ArtifactPhase = 'save' | 'tools'
type Tab = 'explain' | 'rewrite' | 'meaning' | 'illustrate'
type RewriteMode = 'другой-финал' | 'другая-эпоха' | 'другой-стиль'

interface HighlightArtifactProps {
  open: boolean
  text: string
  chapterTitle: string
  anchorRect: DOMRect | null
  releaseSlug: string
  chapterId: string
  paragraphIndex: number
  contextBefore: string
  contextAfter: string
  currentUserId: string | null
  onSaved: (highlight: ChapterHighlight) => void
  onClose: () => void
  accent: string
  bg: string
  textColor: string
  isEditor: boolean
  onSaveEditorial: (note: string) => Promise<void>
}

function uuidToHsl(id: string): string {
  let hash = 0
  for (let i = 0; i < Math.min(id.length, 8); i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
  }
  return `hsl(${hash % 360}, 20%, 8%)`
}

const AI_TABS: { id: Tab; label: string }[] = [
  { id: 'explain',    label: 'Объясни' },
  { id: 'rewrite',    label: 'Перепиши' },
  { id: 'meaning',    label: 'Смысл' },
  { id: 'illustrate', label: 'Нарисуй' },
]

const REWRITE_MODES: { id: RewriteMode; label: string }[] = [
  { id: 'другой-финал', label: 'Другой финал' },
  { id: 'другая-эпоха', label: 'Другая эпоха' },
  { id: 'другой-стиль', label: 'Другой стиль' },
]

export function HighlightArtifact({
  open,
  text,
  chapterTitle,
  anchorRect,
  releaseSlug,
  chapterId,
  paragraphIndex,
  contextBefore,
  contextAfter,
  currentUserId,
  onSaved,
  onClose,
  accent,
  bg,
  textColor,
  isEditor,
  onSaveEditorial,
}: HighlightArtifactProps) {
  const [phase, setPhase] = useState<ArtifactPhase>('save')
  const [savedHighlight, setSavedHighlight] = useState<ChapterHighlight | null>(null)

  // Save form state
  const [note, setNote] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editorialNote, setEditorialNote] = useState('')

  // AI state
  const [activeTab, setActiveTab] = useState<Tab>('explain')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [rewriteMode, setRewriteMode] = useState<RewriteMode | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')

  // Positioning
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({})
  const cardRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Стабильный temp-ID для tint-цвета и shortId (до сохранения highlight).
  // Lazy-init вместо useRef(Math.random()) — React Compiler принимает.
  const [tempId] = useState(() => Math.random().toString(16).slice(2, 14))
  const tintColor = uuidToHsl(tempId)

  // Пересчёт позиции при открытии и ресайзе
  useLayoutEffect(() => {
    if (!open) return

    const calcPosition = () => {
      const CARD_W = 296
      const margin = 12

      if (!anchorRect) {
        setCardStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
        return
      }

      const vw = window.innerWidth
      const vh = window.innerHeight

      // Мобайл — снизу по центру
      if (vw < 640) {
        setCardStyle({
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          top: 'auto',
          borderRadius: '16px 16px 0 0',
          maxHeight: '82vh',
        })
        return
      }

      // Центр выделения по горизонтали
      let left = anchorRect.left + anchorRect.width / 2 - CARD_W / 2
      left = Math.max(margin, Math.min(vw - CARD_W - margin, left))

      // Попытка показать над выделением
      const spaceAbove = anchorRect.top - 60 // 60px header
      const cardH = 420
      let top: number

      if (spaceAbove >= cardH + margin) {
        top = anchorRect.top - cardH - margin
      } else {
        // Под выделением
        top = anchorRect.bottom + margin
        if (top + cardH > vh - margin) {
          // Всё равно не влезает — показываем посередине
          top = Math.max(margin + 50, (vh - cardH) / 2)
        }
      }

      setCardStyle({
        position: 'fixed',
        top,
        left,
        width: CARD_W,
        borderRadius: '6px',
      })
    }

    calcPosition()
    window.addEventListener('resize', calcPosition)
    return () => window.removeEventListener('resize', calcPosition)
  }, [open, anchorRect])

  // Сброс при закрытии диалога. setState в effect — синхронизация internal
  // state с prop (`open`). remount-by-key сломал бы анимацию закрытия.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state on dialog close (sync with open prop)
      setPhase('save')
      setSavedHighlight(null)
      setNote('')
      setIsPublic(false)
      setEditorialNote('')
      setAiText('')
      setAiLoading(false)
      setAiError('')
      setRewriteMode(null)
      setImageUrl(null)
      setImageLoading(false)
      setImageError('')
      abortRef.current?.abort()
    }
  }, [open])

  // Сброс UI при смене вкладки (без abort — streamAI сам отменяет предыдущий)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset AI state on tab change
    setAiText('')
    setAiLoading(false)
    setAiError('')
    setRewriteMode(null)
    setImageUrl(null)
    setImageLoading(false)
    setImageError('')
  }, [activeTab])

  const streamAI = useCallback(async (endpoint: string, body: object) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setAiLoading(true)
    setAiText('')
    setAiError('')
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) { setAiError('Ошибка запроса'); setAiLoading(false); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAiText(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') setAiError('Ошибка сети')
    } finally {
      setAiLoading(false)
    }
  }, [])

  const runExplain = useCallback(() => streamAI('/api/highlights/explain', { text }), [streamAI, text])
  const runMeaning = useCallback(() => streamAI('/api/highlights/meaning', { text }), [streamAI, text])
  const runRewrite = useCallback((mode: RewriteMode) => {
    setRewriteMode(mode)
    streamAI('/api/highlights/rewrite', { text, mode })
  }, [streamAI, text])

  // Автозапуск при смене вкладки (explain / meaning) — вызовы запускают
  // streamAI, который внутри делает setState. Sync с activeTab-пропсом.
  useEffect(() => {
    if (phase !== 'tools') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-trigger AI on tab change
    if (activeTab === 'explain') runExplain()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-trigger AI on tab change
    if (activeTab === 'meaning') runMeaning()
  }, [activeTab, phase, runExplain, runMeaning])

  const handleIllustrate = async () => {
    setImageLoading(true)
    setImageError('')
    setImageUrl(null)
    try {
      const res = await fetch('/api/highlights/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json() as { imageUrl?: string; prompt?: string; error?: string }
      if (!res.ok || data.error) {
        setImageError(data.error === 'unavailable' ? 'Функция пока недоступна' : 'Не удалось сгенерировать')
      } else {
        setImageUrl(data.imageUrl ?? null)
      }
    } catch {
      setImageError('Ошибка сети')
    } finally {
      setImageLoading(false)
    }
  }

  const saveCite = async () => {
    if (!currentUserId) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/chapter-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_id: chapterId,
          text_content: text,
          paragraph_index: paragraphIndex,
          context_before: contextBefore,
          context_after: contextAfter,
          note: note.trim() || null,
          is_public: isPublic,
        }),
      })
      const data = await res.json() as { data?: ChapterHighlight; error?: string }
      if (res.ok && data.data) {
        setSavedHighlight(data.data)
        onSaved(data.data)
        setPhase('tools') // useEffect([activeTab, phase]) запустит explain автоматически
      }
    } finally {
      setIsSaving(false)
    }
  }

  const saveEditorial = async () => {
    if (!editorialNote.trim()) return
    setIsSaving(true)
    try {
      await onSaveEditorial(editorialNote.trim())
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) return null

  const shortId = (savedHighlight?.id ?? tempId).slice(0, 6).toUpperCase()
  const cardTint = savedHighlight ? uuidToHsl(savedHighlight.id) : tintColor

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[98]"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}
      />

      {/* Карточка */}
      <div
        ref={cardRef}
        className="fixed z-[99] flex flex-col overflow-hidden"
        style={{
          ...cardStyle,
          background: bg,
          backgroundImage: `radial-gradient(ellipse at top left, ${cardTint} 0%, transparent 65%)`,
          border: `1px solid ${textColor}18`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 4px 20px rgba(0,0,0,0.4)',
          animation: 'cf-artifact-in 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
          maxHeight: '82vh',
        }}
        onMouseDown={e => {
          const tag = (e.target as HTMLElement).tagName
          if (tag !== 'TEXTAREA' && tag !== 'INPUT') e.preventDefault()
        }}
      >
        {/* Шапка */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-2.5"
          style={{ borderBottom: `1px solid ${textColor}0e`, backgroundColor: `${textColor}05` }}
        >
          {phase === 'save' ? (
            <span className="font-mono text-[10px] tracking-wider opacity-30" style={{ color: textColor }}>
              #{shortId} · {chapterTitle}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: accent }}>
              <Check className="h-3 w-3" />
              #{shortId} сохранён
            </span>
          )}
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center opacity-30 transition-opacity hover:opacity-80"
            style={{ color: textColor }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Цитата */}
        <div
          className="shrink-0 px-4 py-3"
          style={{ borderBottom: `1px solid ${textColor}0a` }}
        >
          <p
            className="font-[family-name:var(--font-cormorant)] text-[15px] italic leading-snug line-clamp-3 opacity-85"
            style={{ color: textColor }}
          >
            «{text.length > 180 ? text.slice(0, 180) + '…' : text}»
          </p>
        </div>

        {/* Контент — зависит от фазы */}
        <div className="flex-1 overflow-y-auto">

          {/* === ФАЗА СОХРАНЕНИЯ === */}
          {phase === 'save' && (
            <div className="flex flex-col gap-3 px-4 py-4">
              {currentUserId ? (
                <>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Личная заметка (опционально)"
                    className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-25"
                    style={{
                      color: textColor,
                      borderBottom: `1px solid ${textColor}15`,
                      paddingBottom: '7px',
                    }}
                  />

                  {/* Pub/private toggle */}
                  <button
                    type="button"
                    onClick={() => setIsPublic(p => !p)}
                    className="flex items-center justify-between rounded-sm px-3 py-2 text-xs transition-colors"
                    style={{ backgroundColor: `${textColor}07` }}
                  >
                    <div className="flex items-center gap-2" style={{ color: isPublic ? textColor : `${textColor}50` }}>
                      {isPublic
                        ? <Globe className="h-3.5 w-3.5" style={{ color: accent }} />
                        : <Lock className="h-3.5 w-3.5" />}
                      <span className="text-[11px]">{isPublic ? 'Публичная — увидят все' : 'Только для меня'}</span>
                    </div>
                    <div
                      className="relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200"
                      style={{ backgroundColor: isPublic ? accent : `${textColor}20` }}
                    >
                      <span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
                        style={{ left: isPublic ? '20px' : '2px' }}
                      />
                    </div>
                  </button>

                  {/* Редакторское замечание */}
                  {isEditor && (
                    <div className="border-t pt-3" style={{ borderColor: `${textColor}0e` }}>
                      <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: '#e97316', opacity: 0.7 }}>
                        Замечание редактора
                      </p>
                      <textarea
                        value={editorialNote}
                        onChange={e => setEditorialNote(e.target.value)}
                        placeholder="Что нужно исправить (обязательно)"
                        rows={2}
                        className="w-full resize-none bg-transparent text-xs leading-6 outline-none placeholder:opacity-25"
                        style={{
                          color: textColor,
                          borderBottom: `1px solid #e9731628`,
                          paddingBottom: '5px',
                        }}
                      />
                      <button
                        onClick={saveEditorial}
                        disabled={isSaving || !editorialNote.trim()}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-opacity disabled:opacity-30"
                        style={{ backgroundColor: '#e97316', color: '#fff', borderRadius: '3px' }}
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Отправить замечание
                      </button>
                    </div>
                  )}

                  <button
                    onClick={saveCite}
                    disabled={isSaving}
                    className="flex w-full items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: accent, color: '#fff', borderRadius: '3px' }}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {isSaving ? 'Сохраняем…' : 'Присвоить артефакт'}
                  </button>
                </>
              ) : (
                <Link
                  href={`/login?redirect=/release/${releaseSlug}`}
                  onClick={onClose}
                  className="flex w-full items-center justify-center py-3 text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{ backgroundColor: accent, color: '#fff', borderRadius: '3px' }}
                >
                  Войти, чтобы сохранить
                </Link>
              )}
            </div>
          )}

          {/* === ФАЗА ИНСТРУМЕНТОВ === */}
          {phase === 'tools' && (
            <div className="flex flex-col">
              {/* Tab strip */}
              <div
                className="flex shrink-0 overflow-x-auto"
                style={{ borderBottom: `1px solid ${textColor}0e` }}
              >
                {AI_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex-1 px-2 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] transition-colors"
                    style={{
                      color: activeTab === tab.id ? accent : `${textColor}40`,
                      borderBottom: activeTab === tab.id ? `2px solid ${accent}` : '2px solid transparent',
                      marginBottom: '-1px',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Контент вкладки */}
              <div className="px-4 py-4">

                {/* ОБЪЯСНИ */}
                {activeTab === 'explain' && (
                  <AiResult
                    aiText={aiText}
                    aiLoading={aiLoading}
                    aiError={aiError}
                    onRetry={runExplain}
                    loadingLabel="Объясняю…"
                    accent={accent}
                    textColor={textColor}
                  />
                )}

                {/* ПЕРЕПИШИ */}
                {activeTab === 'rewrite' && (
                  <div className="flex flex-col gap-3">
                    {!rewriteMode ? (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.16em] opacity-35" style={{ color: textColor }}>
                          Выбери вариант
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {REWRITE_MODES.map(m => (
                            <button
                              key={m.id}
                              onClick={() => runRewrite(m.id)}
                              className="flex items-center gap-2.5 rounded-sm px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.1em] transition-colors"
                              style={{ backgroundColor: `${textColor}08`, color: textColor }}
                            >
                              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.14em] opacity-35" style={{ color: textColor }}>
                            {rewriteMode}
                          </span>
                          <button
                            onClick={() => { setRewriteMode(null); setAiText('') }}
                            className="ml-auto text-[9px] uppercase tracking-[0.1em] opacity-40 transition-opacity hover:opacity-80"
                            style={{ color: accent }}
                          >
                            ← выбрать другое
                          </button>
                        </div>
                        <AiResult
                          aiText={aiText}
                          aiLoading={aiLoading}
                          aiError={aiError}
                          onRetry={() => runRewrite(rewriteMode)}
                          loadingLabel="Переписываю…"
                          accent={accent}
                          textColor={textColor}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* СМЫСЛ */}
                {activeTab === 'meaning' && (
                  <AiResult
                    aiText={aiText}
                    aiLoading={aiLoading}
                    aiError={aiError}
                    onRetry={runMeaning}
                    loadingLabel="Раскрываю смысл…"
                    accent={accent}
                    textColor={textColor}
                  />
                )}

                {/* НАРИСУЙ */}
                {activeTab === 'illustrate' && (
                  <div className="flex flex-col gap-3">
                    {!imageUrl && !imageLoading && !imageError && (
                      <button
                        onClick={handleIllustrate}
                        className="flex w-full items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-[0.14em]"
                        style={{ backgroundColor: accent, color: '#fff', borderRadius: '3px' }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Сгенерировать иллюстрацию
                      </button>
                    )}
                    {imageLoading && (
                      <div className="flex flex-col items-center gap-3 py-6">
                        <div
                          className="h-32 w-full rounded-sm"
                          style={{
                            background: `linear-gradient(90deg, ${textColor}06 25%, ${textColor}12 50%, ${textColor}06 75%)`,
                            backgroundSize: '200% 100%',
                            animation: 'cf-skeleton 1.5s ease infinite',
                          }}
                        />
                        <p className="text-[10px] uppercase tracking-[0.16em] opacity-35" style={{ color: textColor }}>
                          Создаю иллюстрацию…
                        </p>
                      </div>
                    )}
                    {imageError && (
                      <div className="flex flex-col items-center gap-3 py-4">
                        <ImageOff className="h-7 w-7 opacity-20" style={{ color: textColor }} />
                        <p className="text-center text-xs opacity-45" style={{ color: textColor }}>{imageError}</p>
                        {imageError !== 'Функция пока недоступна' && (
                          <button
                            onClick={handleIllustrate}
                            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]"
                            style={{ color: accent }}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Попробовать снова
                          </button>
                        )}
                      </div>
                    )}
                    {imageUrl && (
                      <div className="flex flex-col gap-2">
                        <img src={imageUrl} alt="Иллюстрация" className="w-full rounded-sm" style={{ aspectRatio: '1/1', objectFit: 'cover' }} />
                        <button
                          onClick={handleIllustrate}
                          className="flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
                          style={{ color: accent, border: `1px solid ${accent}30`, borderRadius: '3px' }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Ещё вариант
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function AiResult({
  aiText, aiLoading, aiError,
  onRetry, loadingLabel,
  accent, textColor,
}: {
  aiText: string; aiLoading: boolean; aiError: string
  onRetry: () => void; loadingLabel: string
  accent: string; textColor: string
}) {
  if (aiLoading && !aiText) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: accent }} />
        <span className="text-xs opacity-35" style={{ color: textColor }}>{loadingLabel}</span>
      </div>
    )
  }
  if (aiError && !aiText) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <p className="text-xs opacity-45" style={{ color: textColor }}>{aiError}</p>
        <button onClick={onRetry} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>
          <RotateCcw className="h-3 w-3" />
          Попробовать снова
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {aiText && (
        <p
          className="font-[family-name:var(--font-cormorant)] text-[16px] italic leading-snug"
          style={{ color: textColor, opacity: aiLoading ? 0.75 : 1 }}
        >
          {aiText}
          {aiLoading && <span className="animate-pulse">▌</span>}
        </p>
      )}
      {!aiLoading && aiText && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 self-end text-[9px] uppercase tracking-[0.14em] opacity-35 transition-opacity hover:opacity-70"
          style={{ color: textColor }}
        >
          <RotateCcw className="h-3 w-3" />
          Ещё раз
        </button>
      )}
    </div>
  )
}
