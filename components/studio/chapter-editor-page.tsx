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

    const statusColor = note.status === 'open' ? '#e97316' : note.status === 'resolved' ? '#16a34a' : '#6b7280'
    target.style.transition = 'background-color 0.3s ease-out'
    target.style.backgroundColor = `${statusColor}33`
    setTimeout(() => {
      target.style.backgroundColor = `${statusColor}18`
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
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 md:px-8 py-3">
          <Link href={`/studio/editions/${editionId}`}>
            <Button variant="ghost" size="icon-sm" className="rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex flex-1 items-center gap-2">
            <Badge variant="outline" className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${chapter.status === 'published' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80' : 'bg-amber-50 text-amber-600 border-amber-200/80'}`}>
              {chapter.status === 'published' ? 'Опубликована' : 'Черновик'}
            </Badge>
            <span className="text-sm text-gray-500">
              {saveStatus === 'saving' && <Loader2 className="inline h-3 w-3 animate-spin text-violet-500" />}
              {saveStatus === 'saved' && <Check className="inline h-3 w-3 text-emerald-500" />}
              {saveStatus === 'error' && <AlertCircle className="inline h-3 w-3 text-red-500" />}
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
              className={`rounded-xl ${isHtmlMode ? 'bg-amber-50 text-amber-600 border border-amber-200/80 font-semibold' : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50/50'}`}
            >
              <Code2 className="mr-1.5 h-4 w-4" />
              {isHtmlMode ? 'WYSIWYG' : 'HTML'}
            </Button>
          )}

          {!isAudioEditor && !isComic && <VersionHistory chapterId={chapter.id} />}

          {chapter.status !== 'published' && (
            <Button size="sm" onClick={handlePublish} className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:from-emerald-700 hover:to-emerald-600">
              <Globe className="mr-2 h-4 w-4" />
              Опубликовать
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50/50">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white/80 backdrop-blur-xl border-white/70 rounded-2xl shadow-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-gray-900">Удалить главу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Глава и все её версии будут удалены. Это необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-600 text-white">Удалить</AlertDialogAction>
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
            <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6">
              <ComicPagesEditor
                chapterId={chapter.id}
                initialPages={parseComicPages(chapter.content)}
              />
            </div>
          </div>
        ) : isHtmlMode ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-4">
                <label className="text-sm font-semibold text-gray-600 mb-2 block">HTML код главы</label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full min-h-[60vh] bg-white/60 border border-white/70 rounded-xl font-mono text-sm leading-6 text-gray-800 p-4 resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/70 focus:border-violet-500/70"
                  spellCheck={false}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={switchToWysiwyg}
                    className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80"
                  >
                    Вернуться в редактор
                  </Button>
                  <Button
                    onClick={handleHtmlSave}
                    disabled={saveStatus === 'saving'}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600"
                  >
                    {saveStatus === 'saving' ? 'Сохраняю...' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            </div>
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-4">
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
              <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-4">
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
