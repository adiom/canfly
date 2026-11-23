'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { useRouter, unstable_rethrow } from 'next/navigation'
import { useAutosave } from '@/lib/studio/use-autosave'
import type { ChapterWriteFailure } from '@/lib/studio/chapter-write'
import { archiveChapterDraft, type ChapterDraft } from '@/lib/studio/chapter-drafts'
import { saveChapterAutosave } from '@/lib/studio/chapter-autosave'
import { planLeaseReacquire } from '@/lib/studio/chapter-reacquire'
import { saveMediaDraft, type MediaDraftInput } from '@/lib/studio/media-drafts'
import { ChapterDraftBlocked } from '@/components/studio/chapter-draft-blocked'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Editor } from '@tiptap/react'
import type { Chapter, ChapterEditorialNote, EditionFormat } from '@/lib/releases-types'
import {
  getChapterForRecovery, publishChapterAction, deleteChapterAction, updateChapterAction,
  restoreChapterVersionAction, updateComicChapterPagesAction,
} from '@/lib/actions/studio'
import { TelegraphEditor } from '@/components/studio/telegraph-editor'
import { AudioChapterEditor } from '@/components/studio/audio-chapter-editor'
import { ComicPagesEditor } from '@/components/studio/comic-pages-editor'
import { VersionHistory } from '@/components/studio/version-history'
import { ChapterDraftRecovery } from '@/components/studio/chapter-draft-recovery'
import { ChapterLeaseBanner } from '@/components/studio/chapter-lease-banner'
import { useChapterLease } from '@/lib/studio/use-chapter-lease'
import type { ChapterLeaseProof } from '@/lib/studio/chapter-lease'
import { EditorialNotesPanel } from '@/components/studio/editorial-notes-panel'
import { EditorialNotesOverlay } from '@/components/studio/editorial-notes-overlay'
import { collectParagraphs } from '@/lib/studio/paragraphs'
import { editorialStatusStyle } from '@/lib/studio/editorial-status'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, ChevronLeft, ChevronRight, Globe, Trash2, Check, Loader2, AlertCircle, Code2 } from 'lucide-react'

const audioFormats = new Set<EditionFormat>(['audiobook', 'audiorelease', 'album'])

type ChapterNavTarget = { id: string; title: string }

/** Стрелка «предыдущая/следующая глава»: без соседа кнопка остаётся, но неактивна. */
function ChapterNavButton({
  target,
  editionId,
  label,
  children,
}: {
  target: ChapterNavTarget | null
  editionId: string
  label: string
  children: ReactNode
}) {
  if (!target) {
    return (
      <Button variant="ghost" size="icon-sm" disabled aria-label={label} title={label} className="rounded-xl text-cf-text-4 disabled:opacity-40">
        {children}
      </Button>
    )
  }

  const title = `${label}: ${target.title}`
  return (
    <Button asChild variant="ghost" size="icon-sm" className="rounded-xl text-cf-text-3 hover:text-cf-accent hover:bg-cf-accent/10">
      <Link href={`/studio/editions/${editionId}/chapters/${target.id}`} aria-label={title} title={title}>
        {children}
      </Link>
    </Button>
  )
}

function parseComicPages(content: string | null): string[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {}
  return []
}

export function ChapterEditorPage({
  chapter,
  editorUserId,
  editionId,
  editionFormat,
  prevChapter,
  nextChapter,
}: {
  chapter: Chapter
  editorUserId: string
  editionId: string
  editionFormat: EditionFormat
  prevChapter: ChapterNavTarget | null
  nextChapter: ChapterNavTarget | null
}) {
  const router = useRouter()
  const isAudioEditor = audioFormats.has(editionFormat)
  const isComic = editionFormat === 'comic'
  const [mediaSaveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [chapterTitle, setChapterTitle] = useState(chapter.title)
  const [chapterSnapshot, setChapterSnapshot] = useState(chapter)
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
  const [editorialNotes, setEditorialNotes] = useState<ChapterEditorialNote[]>([])
  const [isHtmlMode, setIsHtmlMode] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [initialContent, setInitialContent] = useState(chapter.content)
  const editorRef = useRef<HTMLDivElement | null>(null)
  // Отдельный state для DOM-узла редактора — нужен, чтобы передать его как
  // пропс в EditorialNotesOverlay без чтения ref.current во время render.
  const [editorContainer, setEditorContainer] = useState<HTMLDivElement | null>(null)
  const editorCallbackRef = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node
    setEditorContainer(node)
  }, [])
  const tiptapRef = useRef<Editor | null>(null)
  const revisionRef = useRef(chapter.revision)
  const leaseProofRef = useRef<ChapterLeaseProof | null>(null)
  const readOnlyRef = useRef(true)
  const mediaDraftRef = useRef<MediaDraftInput | null>(null)
  const mediaUploadRef = useRef(false)
  const [unsavedMedia, setUnsavedMedia] = useState<MediaDraftInput | null>(null)
  const handleLocalMedia = useCallback((draft: MediaDraftInput | null, saved = true) => {
    mediaDraftRef.current = draft
    setUnsavedMedia(saved ? null : draft)
  }, [])
  const handleMediaUpload = useCallback((pending: boolean) => {
    mediaUploadRef.current = pending
  }, [])
  const hasExtraDraft = useCallback(() => !!mediaDraftRef.current || mediaUploadRef.current, [])
  const persistExtraDraft = useCallback(() => {
    const draft = mediaDraftRef.current
    const saved = !draft || saveMediaDraft(draft)
    setUnsavedMedia(saved ? null : draft)
    return saved && !mediaUploadRef.current
  }, [])
  const isReadOnly = useCallback(() => readOnlyRef.current, [])
  const getRevision = useCallback(() => revisionRef.current, [])
  const saveComicPages = useCallback(async (pages: string[]) => {
    const proof = readOnlyRef.current ? null : leaseProofRef.current
    if (!proof) {
      return {
        ok: false as const,
        code: 'lease-lost' as const,
        message: 'Редактирование недоступно: глава открыта в другой сессии.',
      }
    }
    const result = await updateComicChapterPagesAction(chapter.id, revisionRef.current, proof, pages)
    if (result.ok) revisionRef.current = result.value.revision
    return result
  }, [chapter.id])
  const restorePending = useRef(false)
  const [restoring, setRestoring] = useState(false)
  const [saveError, setSaveError] = useState<ChapterWriteFailure | null>(null)
  const [blockedRecovery, setBlockedRecovery] = useState<{
    fresh: Chapter
    draft: ChapterDraft
  } | null>(null)
  const [accessRevoked, setAccessRevoked] = useState(false)
  const accessRevokedRef = useRef(false)
  const [, setContentVersion] = useState(0)
  const archivePrefix = `cf-chapter-draft-archive:${editorUserId}:${chapter.id}:`
  const archiveDraft = useCallback((draft: ChapterDraft, revision: number) =>
    archiveChapterDraft(archivePrefix, draft, revision), [archivePrefix])
  const applyDraft = useCallback((draft: ChapterDraft) => {
    setChapterTitle(draft.title)
    setInitialContent(draft.content)
    setHtmlContent(draft.content)
    const editor = tiptapRef.current
    if (editor && !editor.isDestroyed) editor.commands.setContent(draft.content, { emitUpdate: false })
  }, [])
  const autosave = useAutosave({
    storageKey: `cf-chapter-draft:${editorUserId}:${chapter.id}`,
    legacyStorageKey: `cf-chapter-draft:${chapter.id}`,
    initial: { title: chapter.title, content: chapter.content ?? '' },
    getRevision,
    archiveDraft,
    isReadOnly,
    hasExtraDraft,
    persistExtraDraft,
    save: async (draft, patch) => {
      const outcome = await saveChapterAutosave(draft, patch, {
        revision: revisionRef.current,
        proof: readOnlyRef.current ? null : leaseProofRef.current,
        archive: archiveDraft,
        update: (revision, proof, nextPatch) => updateChapterAction(
          chapter.id,
          revision,
          proof,
          nextPatch,
        ),
      })

      if (outcome.archiveFailed) {
        toast.warning('Браузер не смог записать архив. Скопируйте текст из редактора.')
      }
      if (outcome.revision !== undefined) revisionRef.current = outcome.revision
      if (outcome.failure) {
        if (outcome.failure.code === 'forbidden') {
          accessRevokedRef.current = true
          setAccessRevoked(true)
        }
        setSaveError(error => error && (error.code === 'conflict' || error.code === 'not-found')
          ? error
          : outcome.failure!)
      } else {
        setSaveError(null)
        setRecoveryNotice(null)
      }
      return outcome.result
    },
    onRestore: applyDraft,
  })

  function archiveLocalDraft(): boolean {
    const textSaved = !autosave.isDirty() || archiveDraft(autosave.getValue(), revisionRef.current)
    return persistExtraDraft() && textSaved
  }

  function applyServerSnapshot(fresh: Chapter) {
    revisionRef.current = fresh.revision
    setChapterSnapshot(fresh)
    const draft = { title: fresh.title, content: fresh.content ?? '' }
    autosave.reset(draft)
    if (!isAudioEditor && !isComic) applyDraft(draft)
    setSaveError(null)
  }

  function retryBlockedArchive() {
    if (!blockedRecovery) return
    if (!archiveLocalDraft()) {
      toast.error('Хранилище всё ещё недоступно. Скопируйте текст из редактора.')
      return
    }
    applyServerSnapshot(blockedRecovery.fresh)
    setBlockedRecovery(null)
    setRecoveryNotice('Черновик сохранён в «Локальные черновики». Загружена серверная версия.')
  }

  function loadBlockedServerVersion() {
    if (!blockedRecovery) return
    applyServerSnapshot(blockedRecovery.fresh)
    setBlockedRecovery(null)
    setRecoveryNotice(null)
    toast.warning('Загружена серверная версия. Локальный текст остался в редакторе до этого действия.')
  }

  async function copyBlockedDraft() {
    if (!blockedRecovery) return
    try {
      await navigator.clipboard.writeText(blockedRecovery.draft.content)
      toast.success('Текст черновика скопирован')
    } catch {
      toast.error('Выделите текст в поле черновика и скопируйте вручную')
    }
  }

  const lease = useChapterLease({
    chapterId: chapter.id,
    onLost: () => {
      if (!autosave.isDirty() && !hasExtraDraft()) return
      const archived = archiveLocalDraft()
      if (archived) {
        toast.warning('Право редактирования потеряно. Правки сохранены в локальных черновиках.')
      } else {
        toast.error('Не удалось сохранить черновик в архив. Скопируйте текст из редактора.')
      }
    },
    onAcquired: async (acquired) => {
      if (accessRevokedRef.current || mediaUploadRef.current) return false
      leaseProofRef.current = {
        sessionId: acquired.sessionId,
        token: acquired.token,
        generation: acquired.generation,
      }
      // onAcquired вызывается при повторном захвате; до завершения
      // восстановления редактор остаётся read-only.
      try {
        const fresh = await getChapterForRecovery(chapter.id)
        if (!fresh) {
          archiveLocalDraft()
          accessRevokedRef.current = true
          setAccessRevoked(true)
          return false
        }
        if (accessRevokedRef.current || mediaUploadRef.current) return false
        const dirty = autosave.isDirty() || hasExtraDraft()
        const archived = fresh.revision === revisionRef.current || archiveLocalDraft()
        const action = planLeaseReacquire({
          dirty,
          currentRevision: revisionRef.current,
          freshRevision: fresh.revision,
          archived,
        })
        if (action === 'blocked') {
          readOnlyRef.current = true
          setBlockedRecovery({
            fresh,
            draft: mediaDraftRef.current
              ? { title: mediaDraftRef.current.title, content: JSON.stringify(mediaDraftRef.current, null, 2) }
              : autosave.getValue(),
          })
          setSaveError({
            ok: false,
            code: 'error',
            message: 'Черновик не сохранён в браузере. Скопируйте текст перед загрузкой серверной версии.',
          })
          return true
        }
        if (action === 'retry') {
          setSaveError(null)
          // Восстановление подтверждено: lease наш, ревизия совпадает.
          readOnlyRef.current = false
          if (autosave.isDirty()) {
            try {
              await autosave.flush()
            } catch {
              // Ошибка остаётся видимой, черновик уже в архиве/sessionStorage.
            }
          }
          return !accessRevokedRef.current
        }
        if (action === 'none') {
          setSaveError(null)
          return true
        }

        applyServerSnapshot(fresh)
        setRecoveryNotice(
          'Глава изменилась, пока вы были в режиме чтения. Загружена серверная версия; ваш текст сохранён в «Локальные черновики».',
        )
        toast.warning('Глава изменилась. Откройте «Локальные черновики», чтобы восстановить свой текст.')
        return true
      } catch {
        setSaveError({
          ok: false,
          code: 'error',
          message: 'Не удалось перечитать главу после возврата права редактирования.',
        })
        return false
      }
    },
  })

  const readOnly = lease.state.status !== 'active' || blockedRecovery !== null || autosave.blockedDraft !== null || accessRevoked

  const abandonLease = lease.abandon
  useEffect(() => {
    if (accessRevoked) abandonLease()
  }, [accessRevoked, abandonLease])

  useEffect(() => {
    leaseProofRef.current = lease.proof
    readOnlyRef.current = readOnly
  }, [lease.proof, readOnly])
  const revoked = accessRevoked || (lease.state.status === 'error' && lease.state.revoked === true)
  const saveStatus = revoked ? 'error' : isAudioEditor || isComic ? mediaSaveStatus : autosave.status
  const titleError = !isAudioEditor && !isComic && !chapterTitle.trim() ? 'Введите заголовок главы' : null
  const saveMessage = revoked ? 'Доступ к главе отозван' : recoveryNotice ?? (saveError?.code === 'conflict'
    ? 'Глава изменилась после открытия. Проверьте локальные черновики перед перезагрузкой.'
    : saveError?.code === 'lease-lost' || saveError?.code === 'lease-held'
      ? 'Режим только для чтения: правки сохраняются в локальные черновики.'
      : saveError?.message ?? titleError)
  const canRestoreDraft = !restoring && !readOnly && saveError?.code !== 'conflict' && saveError?.code !== 'not-found'
  const updateDraft = autosave.update
  const handleDraftChange = useCallback((patch: { title?: string; content?: string }) => {
    if (restorePending.current) return
    if (patch.title !== undefined) {
      setChapterTitle(patch.title)
      if (patch.title.trim()) {
        setSaveError(error => error?.code === 'validation' ? null : error)
      }
    }
    updateDraft(patch)
  }, [updateDraft])

  function restoreLocalText(draft: ChapterDraft) {
    if (!canRestoreDraft || restorePending.current) return false
    const current = autosave.getValue()
    if (autosave.isDirty() && !archiveDraft(current, revisionRef.current)) {
      toast.error('Не удалось сохранить текущий черновик в архив. Скопируйте его перед восстановлением.')
      return false
    }
    updateDraft({ content: draft.content })
    applyDraft({ ...current, content: draft.content })
    return true
  }

  function applyWriteFailure(failure: ChapterWriteFailure) {
    if (failure.code === 'forbidden') {
      accessRevokedRef.current = true
      setAccessRevoked(true)
    }
    setSaveError(failure)
  }

  async function handleRestoreVersion(versionId: string) {
    if (restorePending.current) return
    restorePending.current = true
    setRestoring(true)
    try {
      if (tiptapRef.current && !tiptapRef.current.isDestroyed) tiptapRef.current.setEditable(false, false)
      await autosave.flush()
      const proof = leaseProofRef.current
      if (!proof) {
        const failure: ChapterWriteFailure = {
          ok: false,
          code: 'lease-lost',
          message: 'Восстановление недоступно: глава открыта в другой сессии.',
        }
        setSaveError(failure)
        throw new Error(failure.message)
      }
      const result = await restoreChapterVersionAction(chapter.id, versionId, revisionRef.current, proof)
      if (!result.ok) {
        applyWriteFailure(result)
        throw new Error(result.message)
      }
      revisionRef.current = result.value.revision
      setChapterSnapshot(result.value)
      const draft = { title: result.value.title, content: result.value.content ?? '' }
      autosave.reset(draft)
      applyDraft(draft)
      setSaveError(null)
      setRecoveryNotice(null)
    } finally {
      if (tiptapRef.current && !tiptapRef.current.isDestroyed) {
        tiptapRef.current.setEditable(!readOnlyRef.current && !accessRevokedRef.current, false)
      }
      restorePending.current = false
      setRestoring(false)
    }
  }

  const handleEditorReady = useCallback((editor: Editor) => {
    tiptapRef.current = editor
  }, [])

  const handleNoteFocus = useCallback((note: ChapterEditorialNote) => {
    const container = editorRef.current
    if (!container || !note.text_content) return

    const proseMirror = container.querySelector('.ProseMirror')
    if (!proseMirror) return

    const paragraphs = collectParagraphs(proseMirror)

    let target: HTMLElement | null = null

    for (const p of paragraphs) {
      const text = p.textContent ?? ''
      if (text.includes(note.text_content)) {
        target = p
        break
      }
    }

    if (!target && note.context_before) {
      for (const p of paragraphs) {
        const text = p.textContent ?? ''
        if (text.includes(note.context_before)) {
          target = p
          break
        }
      }
    }

    if (!target && note.paragraph_index != null) {
      target = paragraphs[note.paragraph_index]
    }

    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const statusColor = editorialStatusStyle(note.status).color
    target.style.transition = 'background-color 0.3s ease-out'
    target.style.backgroundColor = `color-mix(in srgb, ${statusColor} 20%, transparent)`
    setTimeout(() => {
      target.style.backgroundColor = `color-mix(in srgb, ${statusColor} 9%, transparent)`
      setTimeout(() => {
        target.style.backgroundColor = ''
      }, 1500)
    }, 1500)
  }, [])

  const handleContentUpdate = useCallback(() => {
    setContentVersion(v => v + 1)
  }, [])

  async function switchToHtml() {
    if (!tiptapRef.current) return
    try {
      await autosave.flush()
      setHtmlContent(tiptapRef.current.getHTML())
      setIsHtmlMode(true)
    } catch (error) {
      unstable_rethrow(error)
      toast.error('Не удалось сохранить правки')
    }
  }

  async function switchToWysiwyg() {
    try {
      await autosave.flush()
      setInitialContent(htmlContent)
      setIsHtmlMode(false)
    } catch (error) {
      unstable_rethrow(error)
      toast.error('Не удалось сохранить правки')
    }
  }

  async function handleHtmlSave() {
    try {
      await autosave.flush()
      setInitialContent(htmlContent)
    } catch (error) {
      unstable_rethrow(error)
      toast.error('Не удалось сохранить правки')
    }
  }

  async function handlePublish() {
    if (restorePending.current) return
    try {
      await autosave.flush()
      const proof = leaseProofRef.current
      if (!proof) throw new Error('Публикация недоступна: глава открыта в другой сессии.')
      const result = await publishChapterAction(chapter.id, revisionRef.current, proof)
      if (!result.ok) {
        applyWriteFailure(result)
        toast.error(result.message)
        return
      }
      revisionRef.current = result.value.revision
      toast.success('Глава опубликована')
      router.refresh()
    } catch (error) {
      unstable_rethrow(error)
      toast.error('Ошибка публикации')
    }
  }

  async function handleDelete() {
    if (restorePending.current) return
    try {
      await autosave.flush()
      const proof = leaseProofRef.current
      if (!proof) throw new Error('Удаление недоступно: глава открыта в другой сессии.')
      const result = await deleteChapterAction(chapter.id, revisionRef.current, proof)
      if (!result.ok) {
        applyWriteFailure(result)
        toast.error(result.message)
      }
    } catch (error) {
      unstable_rethrow(error)
      toast.error('Ошибка удаления')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-cf-text-1/10 bg-cf-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 md:px-8 py-3">
          <Link href={`/studio/editions/${editionId}`}>
            <Button variant="ghost" size="icon-sm" className="rounded-xl text-cf-text-3 hover:text-cf-accent hover:bg-cf-accent/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex flex-1 items-center gap-2">
            <Badge variant="outline" className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${chapter.status === 'published' ? 'bg-cf-status-resolved/15 text-cf-status-resolved border-cf-status-resolved/40' : 'bg-cf-status-open/15 text-cf-status-open border-cf-status-open/40'}`}>
              {chapter.status === 'published' ? 'Опубликована' : 'Черновик'}
            </Badge>
            <span className="text-sm text-cf-text-3" role="status" aria-live="polite">
              {saveStatus === 'pending' && 'Есть несохранённые правки'}
              {saveStatus === 'saving' && <Loader2 className="inline h-3 w-3 animate-spin text-cf-accent" />}
              {saveStatus === 'saved' && !saveMessage && <Check className="inline h-3 w-3 text-cf-status-resolved" />}
              {(saveStatus === 'error' || saveMessage) && <AlertCircle className="inline h-3 w-3 text-cf-accent" />}
              {saveStatus === 'saving' && ' Сохраняю...'}
              {saveStatus === 'saved' && !saveMessage && ' Сохранено'}
              {saveMessage || (saveStatus === 'error' && ' Ошибка')}
            </span>
          </div>

          {(prevChapter || nextChapter) && (
            <div className="flex items-center gap-1">
              <ChapterNavButton target={prevChapter} editionId={editionId} label="Предыдущая глава">
                <ChevronLeft className="h-4 w-4" />
              </ChapterNavButton>
              <ChapterNavButton target={nextChapter} editionId={editionId} label="Следующая глава">
                <ChevronRight className="h-4 w-4" />
              </ChapterNavButton>
            </div>
          )}

          {!isAudioEditor && !isComic && (
            <Button
              variant="ghost"
              size="sm"
              disabled={restoring || readOnly}
              onClick={isHtmlMode ? switchToWysiwyg : switchToHtml}
              className={`rounded-xl ${isHtmlMode ? 'bg-cf-status-open/15 text-cf-status-open border border-cf-status-open/40 font-semibold' : 'text-cf-text-3 hover:text-cf-accent hover:bg-cf-accent/10'}`}
            >
              <Code2 className="mr-1.5 h-4 w-4" />
              {isHtmlMode ? 'WYSIWYG' : 'HTML'}
            </Button>
          )}

          {!isAudioEditor && !isComic && (
            <VersionHistory chapterId={chapter.id} onRestore={handleRestoreVersion} disabled={readOnly} />
          )}
          {!isAudioEditor && !isComic && (
            <ChapterDraftRecovery prefix={archivePrefix} canRestore={canRestoreDraft} onRestore={restoreLocalText} />
          )}

          {chapter.status !== 'published' && (
            <Button size="sm" disabled={restoring || readOnly} onClick={handlePublish} className="rounded-xl bg-cf-status-resolved text-cf-bg hover:opacity-90">
              <Globe className="mr-2 h-4 w-4" />
              Опубликовать
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={restoring || readOnly} className="rounded-xl text-cf-text-4 hover:text-cf-accent hover:bg-cf-accent/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-cf-bg-2 border-cf-text-1/10 rounded-2xl shadow-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-cf-text-heading">Удалить главу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Глава и все её версии будут удалены. Это необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-cf-accent text-cf-bg hover:bg-cf-accent-hover">Удалить</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <ChapterLeaseBanner state={lease.state} onRetry={() => void lease.reacquire()} />
      {autosave.blockedDraft && (
        <div role="alert" className="mx-auto max-w-4xl space-y-2 p-4">
          <p>Не удалось перенести старый черновик в архив. Скопируйте его или освободите место и повторите.</p>
          <textarea aria-label="Старый локальный черновик" readOnly value={autosave.blockedDraft.content} className="w-full font-mono" />
          <Button size="sm" onClick={autosave.retryArchive}>Повторить архивацию</Button>
        </div>
      )}
      {unsavedMedia && !blockedRecovery && (
        <div role="alert" className="mx-auto max-w-4xl space-y-2 p-4">
          <p>Медиачерновик не записан. Скопируйте его перед уходом.</p>
          <textarea aria-label="Несохранённый медиачерновик" readOnly value={JSON.stringify(unsavedMedia, null, 2)} className="w-full font-mono" />
        </div>
      )}
      {blockedRecovery && (
        <ChapterDraftBlocked
          draft={blockedRecovery.draft}
          onCopy={() => void copyBlockedDraft()}
          onRetry={retryBlockedArchive}
          onLoadServer={loadBlockedServerVersion}
        />
      )}

      <div className="mx-auto max-w-6xl px-4 md:px-8 py-8">
        {isAudioEditor ? (
          <div className="mx-auto max-w-4xl">
            <AudioChapterEditor
              key={`audio:${chapterSnapshot.revision}`}
              chapter={chapterSnapshot}
              revisionRef={revisionRef}
              leaseRef={leaseProofRef}
              readOnly={readOnly}
              onSaveStatus={setSaveStatus}
              onLocalDraft={handleLocalMedia}
              onUploadPending={handleMediaUpload}
              draftOwner={editorUserId}
            />
          </div>
        ) : isComic ? (
          <div className="mx-auto max-w-4xl">
            <div className="bg-cf-bg-2 border border-cf-text-1/10 rounded-2xl p-5 md:p-6">
              <ComicPagesEditor
                key={`comic:${chapterSnapshot.revision}`}
                initialPages={parseComicPages(chapterSnapshot.content)}
                savePages={saveComicPages}
                getRevision={getRevision}
                readOnly={readOnly}
                accessRevoked={revoked}
                onLocalDraft={handleLocalMedia}
                onUploadPending={handleMediaUpload}
                draftOwner={editorUserId}
                chapterId={chapter.id}
                chapterRevision={chapterSnapshot.revision}
              />
            </div>
          </div>
        ) : isHtmlMode ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="bg-cf-bg-2 border border-cf-text-1/10 rounded-2xl p-4">
                <label className="text-sm font-semibold text-cf-text-2 mb-2 block">HTML код главы</label>
                <textarea
                  disabled={restoring || readOnly}
                  value={htmlContent}
                  onChange={(e) => {
                    setHtmlContent(e.target.value)
                    handleDraftChange({ content: e.target.value })
                  }}
                  className="w-full min-h-[60vh] bg-cf-bg border border-cf-text-1/10 rounded-xl font-mono text-sm leading-6 text-cf-text-1 p-4 resize-y focus:outline-none focus:ring-2 focus:ring-cf-accent/70 focus:border-cf-accent/70"
                  spellCheck={false}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    disabled={restoring || readOnly}
                    onClick={switchToWysiwyg}
                    className="rounded-xl border-cf-text-1/10 bg-cf-bg text-cf-text-2 hover:bg-cf-bg-2"
                  >
                    Вернуться в редактор
                  </Button>
                  <Button
                    onClick={handleHtmlSave}
                    disabled={restoring || readOnly || saveStatus === 'saving'}
                    className="rounded-xl bg-cf-accent text-cf-bg hover:bg-cf-accent-hover"
                  >
                    {saveStatus === 'saving' ? 'Сохраняю...' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            </div>
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="bg-cf-bg-2 border border-cf-text-1/10 rounded-2xl p-4">
                <EditorialNotesPanel
                  chapterId={chapter.id}
                  onNoteFocus={handleNoteFocus}
                  editorialNotes={editorialNotes}
                  onNotesUpdate={setEditorialNotes}
                />
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="relative">
              <EditorialNotesOverlay
                editorContainer={editorContainer}
                notes={editorialNotes}
                onIndicatorClick={handleNoteFocus}
              />
              <TelegraphEditor
                ref={editorCallbackRef}
                disabled={restoring || readOnly}
                initialTitle={chapterTitle}
                initialContent={initialContent}
                onDraftChange={handleDraftChange}
                onContentUpdate={handleContentUpdate}
                onEditorReady={handleEditorReady}
              />
            </div>
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="bg-cf-bg-2 border border-cf-text-1/10 rounded-2xl p-4">
                <EditorialNotesPanel
                  chapterId={chapter.id}
                  onNoteFocus={handleNoteFocus}
                  editorialNotes={editorialNotes}
                  onNotesUpdate={setEditorialNotes}
                />
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
