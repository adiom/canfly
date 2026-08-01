'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Editor } from '@tiptap/react'
import type { Chapter, ChapterEditorialNote, EditionFormat } from '@/lib/releases-types'
import { publishChapterAction, deleteChapterAction, updateChapterAction } from '@/lib/actions/studio'
import { TelegraphEditor } from '@/components/studio/telegraph-editor'
import { AudioChapterEditor } from '@/components/studio/audio-chapter-editor'
import { ComicPagesEditor } from '@/components/studio/comic-pages-editor'
import { VersionHistory } from '@/components/studio/version-history'
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
import { ArrowLeft, Globe, Trash2, Check, Loader2, AlertCircle, Code2 } from 'lucide-react'

const audioFormats = new Set<EditionFormat>(['audiobook', 'audiorelease', 'album'])

function parseComicPages(content: string | null): string[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {}
  return []
}

export function ChapterEditorPage({ chapter, editionId, editionFormat }: { chapter: Chapter; editionId: string; editionFormat: EditionFormat }) {
  const router = useRouter()
  const isAudioEditor = audioFormats.has(editionFormat)
  const isComic = editionFormat === 'comic'
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
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
  const [, setContentVersion] = useState(0)

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

  function switchToHtml() {
    if (!tiptapRef.current) return
    setHtmlContent(tiptapRef.current.getHTML())
    setIsHtmlMode(true)
  }

  function switchToWysiwyg() {
    setInitialContent(htmlContent)
    setIsHtmlMode(false)
  }

  async function handleHtmlSave() {
    setSaveStatus('saving')
    try {
      await updateChapterAction(chapter.id, { title: chapter.title, content: htmlContent })
      setInitialContent(htmlContent)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }

  async function handlePublish() {
    try {
      await publishChapterAction(chapter.id)
      toast.success('Глава опубликована')
      router.refresh()
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка публикации')
    }
  }

  async function handleDelete() {
    try {
      await deleteChapterAction(chapter.id)
    } catch (error) {
      if (isRedirectError(error)) throw error
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
            <span className="text-sm text-cf-text-3">
              {saveStatus === 'saving' && <Loader2 className="inline h-3 w-3 animate-spin text-cf-accent" />}
              {saveStatus === 'saved' && <Check className="inline h-3 w-3 text-cf-status-resolved" />}
              {saveStatus === 'error' && <AlertCircle className="inline h-3 w-3 text-cf-accent" />}
              {saveStatus === 'saving' && ' Сохраняю...'}
              {saveStatus === 'saved' && ' Сохранено'}
              {saveStatus === 'error' && ' Ошибка'}
            </span>
          </div>

          {!isAudioEditor && !isComic && (
            <Button
              variant="ghost"
              size="sm"
              onClick={isHtmlMode ? switchToWysiwyg : switchToHtml}
              className={`rounded-xl ${isHtmlMode ? 'bg-cf-status-open/15 text-cf-status-open border border-cf-status-open/40 font-semibold' : 'text-cf-text-3 hover:text-cf-accent hover:bg-cf-accent/10'}`}
            >
              <Code2 className="mr-1.5 h-4 w-4" />
              {isHtmlMode ? 'WYSIWYG' : 'HTML'}
            </Button>
          )}

          {!isAudioEditor && !isComic && <VersionHistory chapterId={chapter.id} />}

          {chapter.status !== 'published' && (
            <Button size="sm" onClick={handlePublish} className="rounded-xl bg-cf-status-resolved text-cf-bg hover:opacity-90">
              <Globe className="mr-2 h-4 w-4" />
              Опубликовать
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-xl text-cf-text-4 hover:text-cf-accent hover:bg-cf-accent/10">
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

      <div className="mx-auto max-w-6xl px-4 md:px-8 py-8">
        {isAudioEditor ? (
          <div className="mx-auto max-w-4xl">
            <AudioChapterEditor chapter={chapter} onSaveStatus={setSaveStatus} />
          </div>
        ) : isComic ? (
          <div className="mx-auto max-w-4xl">
            <div className="bg-cf-bg-2 border border-cf-text-1/10 rounded-2xl p-5 md:p-6">
              <ComicPagesEditor
                chapterId={chapter.id}
                initialPages={parseComicPages(chapter.content)}
              />
            </div>
          </div>
        ) : isHtmlMode ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="bg-cf-bg-2 border border-cf-text-1/10 rounded-2xl p-4">
                <label className="text-sm font-semibold text-cf-text-2 mb-2 block">HTML код главы</label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full min-h-[60vh] bg-cf-bg border border-cf-text-1/10 rounded-xl font-mono text-sm leading-6 text-cf-text-1 p-4 resize-y focus:outline-none focus:ring-2 focus:ring-cf-accent/70 focus:border-cf-accent/70"
                  spellCheck={false}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={switchToWysiwyg}
                    className="rounded-xl border-cf-text-1/10 bg-cf-bg text-cf-text-2 hover:bg-cf-bg-2"
                  >
                    Вернуться в редактор
                  </Button>
                  <Button
                    onClick={handleHtmlSave}
                    disabled={saveStatus === 'saving'}
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
                chapterId={chapter.id}
                initialTitle={chapter.title}
                initialContent={initialContent}
                onSaveStatus={setSaveStatus}
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
