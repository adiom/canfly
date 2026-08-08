'use client'

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BookmarkPlus,
  Check,
  CircleAlert,
  Globe,
  ImageOff,
  Loader2,
  Lock,
  PencilLine,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import type { ChapterHighlight } from '@/lib/releases-types'

type ArtifactView = 'menu' | 'note' | 'editorial' | 'tools'
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
  startOffset: number
  endOffset: number
  currentUserId: string | null
  onSaved: (highlight: ChapterHighlight) => void
  onClose: () => void
  accent: string
  bg: string
  textColor: string
  isEditor: boolean
  onSaveEditorial: (note: string) => Promise<void>
}

const AI_TABS: { id: Tab; label: string }[] = [
  { id: 'explain', label: 'Объясни' },
  { id: 'rewrite', label: 'Перепиши' },
  { id: 'meaning', label: 'Смысл' },
  { id: 'illustrate', label: 'Нарисуй' },
]

const REWRITE_MODES: { id: RewriteMode; label: string }[] = [
  { id: 'другой-финал', label: 'Другой финал' },
  { id: 'другая-эпоха', label: 'Другая эпоха' },
  { id: 'другой-стиль', label: 'Другой стиль' },
]

const AI_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Нужно войти в аккаунт',
  rate_limited: 'Лимит запросов исчерпан. Попробуйте позже',
  timeout: 'Сервис не ответил вовремя',
  provider_error: 'AI-сервис временно недоступен',
  unavailable: 'Функция пока недоступна',
  invalid_response: 'Сервис вернул некорректный ответ',
}

type ArtifactState = {
  view: ArtifactView
  savedHighlight: ChapterHighlight | null
  note: string
  isPublic: boolean
  editorialNote: string
  aiText: string
  aiLoading: boolean
  aiError: string
  rewriteMode: RewriteMode | null
  imageUrl: string | null
  imageLoading: boolean
  imageError: string
}

type ArtifactAction =
  | { type: 'RESET_ALL' }
  | { type: 'RESET_AI' }
  | { type: 'SET_VIEW'; view: ArtifactView }
  | { type: 'SET_SAVED_HIGHLIGHT'; highlight: ChapterHighlight | null }
  | { type: 'SET_NOTE'; note: string }
  | { type: 'SET_IS_PUBLIC'; pub: boolean }
  | { type: 'SET_EDITORIAL_NOTE'; note: string }
  | { type: 'APPEND_AI_TEXT'; text: string }
  | { type: 'SET_AI_TEXT'; text: string }
  | { type: 'SET_AI_LOADING'; loading: boolean }
  | { type: 'SET_AI_ERROR'; error: string }
  | { type: 'SET_REWRITE_MODE'; mode: RewriteMode | null }
  | { type: 'SET_IMAGE_URL'; url: string | null }
  | { type: 'SET_IMAGE_LOADING'; loading: boolean }
  | { type: 'SET_IMAGE_ERROR'; error: string }

const initialArtifactState: ArtifactState = {
  view: 'menu',
  savedHighlight: null,
  note: '',
  isPublic: false,
  editorialNote: '',
  aiText: '',
  aiLoading: false,
  aiError: '',
  rewriteMode: null,
  imageUrl: null,
  imageLoading: false,
  imageError: '',
}

function artifactReducer(state: ArtifactState, action: ArtifactAction): ArtifactState {
  switch (action.type) {
    case 'RESET_ALL':
      return initialArtifactState
    case 'RESET_AI':
      return { ...state, aiText: '', aiLoading: false, aiError: '', rewriteMode: null, imageUrl: null, imageLoading: false, imageError: '' }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'SET_SAVED_HIGHLIGHT':
      return { ...state, savedHighlight: action.highlight }
    case 'SET_NOTE':
      return { ...state, note: action.note }
    case 'SET_IS_PUBLIC':
      return { ...state, isPublic: action.pub }
    case 'SET_EDITORIAL_NOTE':
      return { ...state, editorialNote: action.note }
    case 'APPEND_AI_TEXT':
      return { ...state, aiText: state.aiText + action.text }
    case 'SET_AI_TEXT':
      return { ...state, aiText: action.text }
    case 'SET_AI_LOADING':
      return { ...state, aiLoading: action.loading }
    case 'SET_AI_ERROR':
      return { ...state, aiError: action.error }
    case 'SET_REWRITE_MODE':
      return { ...state, rewriteMode: action.mode }
    case 'SET_IMAGE_URL':
      return { ...state, imageUrl: action.url }
    case 'SET_IMAGE_LOADING':
      return { ...state, imageLoading: action.loading }
    case 'SET_IMAGE_ERROR':
      return { ...state, imageError: action.error }
    default:
      return state
  }
}

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
  startOffset,
  endOffset,
  currentUserId,
  onSaved,
  onClose,
  accent,
  bg,
  textColor,
  isEditor,
  onSaveEditorial,
}: HighlightArtifactProps) {
  const [clientRequestId] = useState(() => crypto.randomUUID())
  const [state, dispatch] = useReducer(artifactReducer, initialArtifactState)
  const {
    view, savedHighlight, note, isPublic, editorialNote,
    aiText, aiLoading, aiError, rewriteMode,
    imageUrl, imageLoading, imageError,
  } = state
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('explain')
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({})

  const abortRef = useRef<AbortController | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    const calcPosition = () => {
      const width = 352
      const margin = 16
      const isMobile = window.innerWidth < 640

      if (isMobile) {
        setCardStyle({
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          width: 'auto',
          maxHeight: '82dvh',
          borderRadius: '18px 18px 0 0',
        })
        return
      }

      if (!anchorRect) {
        setCardStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          width,
          transform: 'translate(-50%, -50%)',
        })
        return
      }

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const estimatedHeight = 430
      let left = anchorRect.left + anchorRect.width / 2 - width / 2
      left = Math.max(margin, Math.min(viewportWidth - width - margin, left))

      const above = anchorRect.top - 60
      const top = above >= estimatedHeight + margin
        ? anchorRect.top - estimatedHeight - margin
        : Math.min(viewportHeight - estimatedHeight - margin, anchorRect.bottom + margin)

      setCardStyle({
        position: 'fixed',
        top: Math.max(64, top),
        left,
        width,
        borderRadius: 8,
      })
    }

    calcPosition()
    window.addEventListener('resize', calcPosition)
    return () => window.removeEventListener('resize', calcPosition)
  }, [anchorRect, open])

  useEffect(() => {
    if (open) return
    dispatch({ type: 'SET_VIEW', view: 'menu' })
    dispatch({ type: 'SET_SAVED_HIGHLIGHT', highlight: null })
    dispatch({ type: 'SET_NOTE', note: '' })
    dispatch({ type: 'SET_IS_PUBLIC', pub: false })
    dispatch({ type: 'SET_EDITORIAL_NOTE', note: '' })
    dispatch({ type: 'SET_AI_TEXT', text: '' })
    dispatch({ type: 'SET_AI_LOADING', loading: false })
    dispatch({ type: 'SET_AI_ERROR', error: '' })
    dispatch({ type: 'SET_REWRITE_MODE', mode: null })
    dispatch({ type: 'SET_IMAGE_URL', url: null })
    dispatch({ type: 'SET_IMAGE_LOADING', loading: false })
    dispatch({ type: 'SET_IMAGE_ERROR', error: '' })
    abortRef.current?.abort()
  }, [open])

  useEffect(() => {
    dispatch({ type: 'SET_AI_TEXT', text: '' })
    dispatch({ type: 'SET_AI_LOADING', loading: false })
    dispatch({ type: 'SET_AI_ERROR', error: '' })
    dispatch({ type: 'SET_REWRITE_MODE', mode: null })
    dispatch({ type: 'SET_IMAGE_URL', url: null })
    dispatch({ type: 'SET_IMAGE_LOADING', loading: false })
    dispatch({ type: 'SET_IMAGE_ERROR', error: '' })
  }, [activeTab])

  const streamAI = useCallback(async (endpoint: string, body: object) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    dispatch({ type: 'SET_AI_LOADING', loading: true })
    dispatch({ type: 'SET_AI_TEXT', text: '' })
    dispatch({ type: 'SET_AI_ERROR', error: '' })
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        dispatch({ type: 'SET_AI_ERROR', error: AI_ERROR_MESSAGES[data?.error ?? ''] ?? 'Ошибка запроса' })
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        dispatch({ type: 'APPEND_AI_TEXT', text: decoder.decode(value, { stream: true }) })
      }
    } catch (error: unknown) {
      if ((error as Error).name !== 'AbortError') dispatch({ type: 'SET_AI_ERROR', error: 'Ошибка сети' })
    } finally {
      dispatch({ type: 'SET_AI_LOADING', loading: false })
    }
  }, [dispatch])

  const runExplain = useCallback(() => streamAI('/api/highlights/explain', { text }), [streamAI, text])
  const runMeaning = useCallback(() => streamAI('/api/highlights/meaning', { text }), [streamAI, text])
  const runRewrite = useCallback((mode: RewriteMode) => {
    dispatch({ type: 'SET_REWRITE_MODE', mode })
    streamAI('/api/highlights/rewrite', { text, mode })
  }, [streamAI, text])

  useEffect(() => {
    if (view !== 'tools') return
    if (activeTab === 'explain') runExplain()
    if (activeTab === 'meaning') runMeaning()
  }, [activeTab, runExplain, runMeaning, view])

  const handleIllustrate = async () => {
    dispatch({ type: 'SET_IMAGE_LOADING', loading: true })
    dispatch({ type: 'SET_IMAGE_ERROR', error: '' })
    dispatch({ type: 'SET_IMAGE_URL', url: null })
    try {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const response = await fetch('/api/highlights/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      const data = await response.json() as { imageUrl?: string; error?: string }
      if (!response.ok || data.error) {
        dispatch({ type: 'SET_IMAGE_ERROR', error: AI_ERROR_MESSAGES[data.error ?? ''] ?? 'Не удалось сгенерировать' })
      } else {
        dispatch({ type: 'SET_IMAGE_URL', url: data.imageUrl ?? null })
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) dispatch({ type: 'SET_IMAGE_ERROR', error: 'Ошибка сети' })
    } finally {
      dispatch({ type: 'SET_IMAGE_LOADING', loading: false })
    }
  }

  const saveHighlight = async () => {
    if (!currentUserId) return
    setIsSaving(true)
    try {
      const response = await fetch('/api/chapter-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_id: chapterId,
          client_request_id: clientRequestId,
          text_content: text,
          paragraph_index: paragraphIndex,
          context_before: contextBefore,
          context_after: contextAfter,
          start_offset: startOffset,
          end_offset: endOffset,
          note: note.trim() || null,
          is_public: isPublic,
        }),
      })
      const data = await response.json().catch(() => null) as { data?: ChapterHighlight; error?: string } | null
      if (!response.ok || !data?.data) return
      dispatch({ type: 'SET_SAVED_HIGHLIGHT', highlight: data.data })
      onSaved(data.data)
      dispatch({ type: 'SET_VIEW', view: 'tools' })
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

  const colorVars = {
    '--artifact-accent': accent,
    '--artifact-bg': bg,
    '--artifact-text': textColor,
  } as React.CSSProperties
  const quote = text.length > 210 ? `${text.slice(0, 210)}…` : text

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть меню фрагмента"
        className="fixed inset-0 z-[98] hidden bg-black/25 max-sm:block"
        onClick={onClose}
      />
      <section
        aria-label="Действия с фрагментом"
        className="fixed z-[99] flex flex-col overflow-hidden border border-cf-text-1/15 bg-[var(--artifact-bg)] text-[var(--artifact-text)] shadow-2xl max-sm:border-x-0 max-sm:border-b-0"
        style={{ ...cardStyle, ...colorVars, animation: 'cf-artifact-in 180ms cubic-bezier(0.22, 0.61, 0.36, 1) both' }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-cf-text-1/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">Фрагмент главы</p>
            <p className="mt-0.5 truncate text-xs text-cf-text-2">{chapterTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex size-9 shrink-0 items-center justify-center text-cf-text-3 transition-colors hover:bg-cf-text-1/6 hover:text-cf-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cf-accent"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="relative shrink-0 border-b border-cf-text-1/10 px-5 py-4 pl-6">
          <span className="absolute inset-y-4 left-0 w-1 bg-[var(--artifact-accent)]" />
          <p className="font-[family-name:var(--font-cormorant)] text-lg italic leading-snug text-cf-text-1">«{quote}»</p>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {view === 'menu' && (
            <div className="py-1">
              <MenuAction
                icon={<BookmarkPlus className="size-4" />}
                title="Сделать highlight"
                description="Личный фрагмент книги с уникальным номером"
                onClick={saveHighlight}
                loading={isSaving}
                accent={accent}
              />
              <MenuAction
                icon={<PencilLine className="size-4" />}
                title="Добавить заметку"
                description="Цитата с вашей пометкой — для профиля и коллекции"
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'note' })}
                accent={accent}
              />
              {isEditor && (
                <MenuAction
                  icon={<CircleAlert className="size-4" />}
                  title="Ошибка"
                  description="Оставить редакторское замечание к фрагменту"
                  onClick={() => dispatch({ type: 'SET_VIEW', view: 'editorial' })}
                  accent={accent}
                />
              )}
            </div>
          )}

          {view === 'note' && (
            <div className="p-4">
              <BackButton onClick={() => dispatch({ type: 'SET_VIEW', view: 'menu' })} />
              <label className="mt-3 block">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">Ваша заметка</span>
                <textarea
                  value={note}
                  onChange={event => dispatch({ type: 'SET_NOTE', note: event.target.value })}
                  rows={3}
                  autoFocus
                  placeholder="Что вы хотите сохранить вместе с этой цитатой?"
                  className="mt-2 w-full resize-none border border-cf-text-1/15 bg-transparent px-3 py-2.5 text-sm leading-6 text-cf-text-1 outline-none placeholder:text-cf-text-3 focus:border-cf-text-1/35"
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <VisibilityButton active={!isPublic} onClick={() => dispatch({ type: 'SET_IS_PUBLIC', pub: false })} icon={<Lock className="size-3.5" />} title="Личная" description="только вам" />
                <VisibilityButton active={isPublic} onClick={() => dispatch({ type: 'SET_IS_PUBLIC', pub: true })} icon={<Globe className="size-3.5" />} title="Публичная" description="видна в профиле" />
              </div>
              <button
                type="button"
                onClick={saveHighlight}
                disabled={isSaving || !note.trim()}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-cf-accent px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-cf-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Сохранить цитату
              </button>
            </div>
          )}

          {view === 'editorial' && (
            <div className="p-4">
              <BackButton onClick={() => dispatch({ type: 'SET_VIEW', view: 'menu' })} />
              <label className="mt-3 block">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">Что нужно исправить</span>
                <textarea
                  value={editorialNote}
                  onChange={event => dispatch({ type: 'SET_EDITORIAL_NOTE', note: event.target.value })}
                  rows={4}
                  autoFocus
                  placeholder="Опишите ошибку или правку конкретно"
                  className="mt-2 w-full resize-none border border-cf-text-1/15 bg-transparent px-3 py-2.5 text-sm leading-6 text-cf-text-1 outline-none placeholder:text-cf-text-3 focus:border-cf-text-1/35"
                />
              </label>
              <button
                type="button"
                onClick={saveEditorial}
                disabled={isSaving || !editorialNote.trim()}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-cf-accent px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-cf-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                Отправить замечание
              </button>
            </div>
          )}

          {view === 'tools' && (
            <div>
              <div className="flex items-center gap-2 border-b border-cf-text-1/10 px-4 py-3">
                <Check className="size-4 text-cf-accent" />
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-2">
                  Highlight #{savedHighlight?.id.slice(0, 6).toUpperCase()}
                </p>
              </div>
              <div className="flex overflow-x-auto border-b border-cf-text-1/10 px-2">
                {AI_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative h-11 shrink-0 px-2.5 text-[9px] font-black uppercase tracking-[0.1em] transition-colors ${activeTab === tab.id ? 'text-cf-accent' : 'text-cf-text-3 hover:text-cf-text-1'}`}
                  >
                    {tab.label}
                    {activeTab === tab.id && <span className="absolute inset-x-2.5 bottom-0 h-0.5 bg-cf-accent" />}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeTab === 'explain' && <AiResult aiText={aiText} aiLoading={aiLoading} aiError={aiError} onRetry={runExplain} loadingLabel="Объясняю…" />}
                {activeTab === 'meaning' && <AiResult aiText={aiText} aiLoading={aiLoading} aiError={aiError} onRetry={runMeaning} loadingLabel="Раскрываю смысл…" />}
                {activeTab === 'rewrite' && (
                  <div className="space-y-3">
                    {!rewriteMode ? (
                      <div className="grid gap-2">
                        {REWRITE_MODES.map(mode => (
                          <button key={mode.id} type="button" onClick={() => runRewrite(mode.id)} className="flex h-11 items-center gap-2 border border-cf-text-1/10 px-3 text-left text-xs font-bold text-cf-text-1 transition-colors hover:border-cf-text-1/30 hover:bg-cf-text-1/6">
                            <Sparkles className="size-3.5 text-cf-accent" />
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => { dispatch({ type: 'SET_REWRITE_MODE', mode: null }); dispatch({ type: 'SET_AI_TEXT', text: '' }) }} className="font-mono text-[9px] uppercase tracking-[0.16em] text-cf-text-3 hover:text-cf-text-1">← Другой вариант</button>
                        <AiResult aiText={aiText} aiLoading={aiLoading} aiError={aiError} onRetry={() => runRewrite(rewriteMode)} loadingLabel="Переписываю…" />
                      </>
                    )}
                  </div>
                )}
                {activeTab === 'illustrate' && <Illustration imageUrl={imageUrl} loading={imageLoading} error={imageError} onGenerate={handleIllustrate} />}
              </div>
            </div>
          )}

          {!currentUserId && view === 'menu' && (
            <div className="border-t border-cf-text-1/10 p-4">
              <Link href={`/login?redirect=/release/${releaseSlug}`} onClick={onClose} className="flex h-12 items-center justify-center bg-cf-accent px-5 text-xs font-black uppercase tracking-[0.14em] text-white">Войти, чтобы сохранить</Link>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function MenuAction({ icon, title, description, onClick, loading, accent }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; loading?: boolean; accent: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="group flex min-h-16 w-full items-center gap-3 border-b border-cf-text-1/10 px-4 py-3 text-left transition-colors hover:bg-cf-text-1/6 disabled:cursor-wait" style={{ '--artifact-accent': accent } as React.CSSProperties}>
      <span className="flex size-9 shrink-0 items-center justify-center border border-cf-text-1/15 text-cf-text-2 transition-colors group-hover:border-[var(--artifact-accent)] group-hover:text-[var(--artifact-accent)]">{loading ? <Loader2 className="size-4 animate-spin" /> : icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-cf-text-1">{title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-cf-text-3">{description}</span>
      </span>
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="font-mono text-[9px] uppercase tracking-[0.16em] text-cf-text-3 transition-colors hover:text-cf-text-1">← Все действия</button>
}

function VisibilityButton({ active, onClick, icon, title, description }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-12 items-center gap-2 border px-2.5 text-left transition-colors ${active ? 'border-cf-accent bg-cf-accent/10 text-cf-text-1' : 'border-cf-text-1/10 text-cf-text-3 hover:border-cf-text-1/30'}`}>
      {icon}
      <span><span className="block text-xs font-bold">{title}</span><span className="block text-[10px]">{description}</span></span>
    </button>
  )
}

function AiResult({ aiText, aiLoading, aiError, onRetry, loadingLabel }: { aiText: string; aiLoading: boolean; aiError: string; onRetry: () => void; loadingLabel: string }) {
  if (aiLoading && !aiText) return <div className="flex items-center gap-2 py-5 text-sm text-cf-text-3"><Loader2 className="size-4 animate-spin text-cf-accent" />{loadingLabel}</div>
  if (aiError && !aiText) return <div className="space-y-3 py-2"><p className="text-sm text-cf-text-3">{aiError}</p><button type="button" onClick={onRetry} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cf-accent"><RotateCcw className="size-3" />Попробовать снова</button></div>
  return <div className="space-y-3">{aiText && <p className="font-[family-name:var(--font-cormorant)] text-lg italic leading-snug text-cf-text-1">{aiText}{aiLoading && <span className="animate-pulse">▌</span>}</p>}{!aiLoading && aiText && <button type="button" onClick={onRetry} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cf-text-3 hover:text-cf-text-1"><RotateCcw className="size-3" />Ещё раз</button>}</div>
}

function Illustration({ imageUrl, loading, error, onGenerate }: { imageUrl: string | null; loading: boolean; error: string; onGenerate: () => void }) {
  if (loading) return <div className="space-y-3 py-2"><div className="h-40 animate-pulse bg-cf-text-1/10" /><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cf-text-3">Создаю иллюстрацию…</p></div>
  if (error) return <div className="flex flex-col items-center gap-3 py-5 text-center"><ImageOff className="size-7 text-cf-text-3" /><p className="text-sm text-cf-text-3">{error}</p><button type="button" onClick={onGenerate} className="font-mono text-[9px] uppercase tracking-[0.16em] text-cf-accent">Попробовать снова</button></div>
  if (imageUrl) return <div className="space-y-3"><div className="relative aspect-square overflow-hidden"><Image src={imageUrl} alt="Иллюстрация по мотивам фрагмента" fill priority sizes="(max-width: 639px) 100vw, 352px" className="object-cover" /></div><button type="button" onClick={onGenerate} className="flex h-10 w-full items-center justify-center gap-1.5 border border-cf-text-1/15 font-mono text-[9px] uppercase tracking-[0.16em] text-cf-text-2 hover:border-cf-text-1/30"><RotateCcw className="size-3" />Ещё вариант</button></div>
  return <button type="button" onClick={onGenerate} className="flex h-12 w-full items-center justify-center gap-2 bg-cf-accent px-5 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-cf-accent-hover"><Sparkles className="size-4" />Создать иллюстрацию</button>
}
