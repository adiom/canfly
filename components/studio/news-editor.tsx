'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import { toast } from 'sonner'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  Minus,
  ImageIcon,
  ExternalLink,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react'

import type { NewsPost } from '@/lib/types'
import { CoverImageUploader } from '@/components/studio/cover-image-uploader'
import {
  updateNewsAction,
  updateNewsStatusAction,
  deleteNewsAction,
} from '@/lib/actions/studio-news'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

interface NewsEditorProps {
  news: NewsPost
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'text-cf-text-3 border-cf-text-1/20' },
  published: { label: 'Опубликована', className: 'text-cf-warm border-cf-warm/40' },
  archived: { label: 'Архив', className: 'text-cf-text-4 border-cf-text-1/15' },
}

type SaveStatus = 'saved' | 'saving' | 'error' | 'idle'

function ToolbarBtn({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={[
        'flex h-8 w-8 items-center justify-center rounded transition-colors',
        active
          ? 'bg-cf-accent/15 text-cf-accent'
          : 'text-cf-text-2 hover:bg-cf-text-1/10 hover:text-cf-text-1',
        disabled ? 'opacity-30 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function NewsEditor({ news }: NewsEditorProps) {
  const [title, setTitle] = useState(news.title)
  const [section, setSection] = useState(news.section)
  const [tag, setTag] = useState(news.tag ?? '')
  const [coverImage, setCoverImage] = useState(news.cover_image ?? '')
  const [status, setStatus] = useState(news.status)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef({
    title: news.title,
    section: news.section,
    tag: news.tag ?? '',
    coverImage: news.cover_image ?? '',
    content: news.content ?? '',
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Начните писать новость...',
      }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-cf-warm underline underline-offset-2' },
      }),
      TiptapImage.configure({
        HTMLAttributes: { class: 'rounded-sm max-w-full mx-auto my-6' },
      }),
    ],
    content: news.content ?? '',
    editorProps: {
      attributes: {
        class:
          'prose prose-lg max-w-none focus:outline-none min-h-[50vh] py-4 prose-headings:text-cf-text-heading prose-headings:font-black prose-headings:uppercase prose-p:mb-5 prose-p:text-cf-text-caption prose-p:leading-8 prose-blockquote:border-l-cf-accent prose-blockquote:text-cf-text-2 prose-strong:text-cf-text-1 prose-em:text-cf-text-2',
      },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(editor.getHTML())
    },
  })

  const save = useCallback(
    async (content: string) => {
      const current = { title, section, tag, coverImage, content }
      const prev = lastSaved.current
      if (
        current.title === prev.title &&
        current.section === prev.section &&
        current.tag === prev.tag &&
        current.coverImage === prev.coverImage &&
        current.content === prev.content
      ) {
        return
      }

      setSaveStatus('saving')
      try {
        const formData = new FormData()
        formData.set('title', title)
        formData.set('section', section)
        formData.set('tag', tag)
        formData.set('content', content)
        formData.set('cover_image', coverImage)
        await updateNewsAction(news.id, formData)
        lastSaved.current = current
        setSaveStatus('saved')
      } catch (error) {
        if (isRedirectError(error)) throw error
        setSaveStatus('error')
      }
    },
    [news.id, title, section, tag, coverImage],
  )

  function scheduleSave(content: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(content), 1500)
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  function handleFieldChange() {
    if (editor) scheduleSave(editor.getHTML())
  }

  async function handleStatusChange(newStatus: 'draft' | 'published' | 'archived') {
    if (newStatus === status) return
    setStatusUpdating(true)
    try {
      await updateNewsStatusAction(news.id, newStatus)
      setStatus(newStatus)
      toast.success(
        newStatus === 'published' ? 'Новость опубликована' :
        newStatus === 'archived' ? 'Новость в архиве' :
        'Сохранено как черновик'
      )
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Не удалось изменить статус')
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteNewsAction(news.id)
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Не удалось удалить')
      setConfirmDelete(false)
    }
  }

  function addLink() {
    if (!editor) return
    const url = window.prompt('URL:')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  function addImage() {
    if (!editor) return
    const url = window.prompt('URL изображения:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const publishedUrl = `/news/${news.id}`

  return (
    <div className="space-y-6">
      {/* Top bar: status + save indicator */}
      <div className="flex items-center justify-between border-b border-cf-text-1/10 pb-4">
        <div className="flex items-center gap-3">
          <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-cf-text-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              Сохранение
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-cf-text-3">
              <Check className="h-3 w-3" />
              Сохранено
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-cf-accent">
              <AlertCircle className="h-3 w-3" />
              Ошибка
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === 'published' && (
            <Link
              href={publishedUrl}
              target="_blank"
              className="flex h-8 w-8 items-center justify-center border border-cf-text-1/10 text-cf-text-3 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-1"
              title="Открыть публичную страницу"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleFieldChange}
        className="w-full bg-transparent text-3xl font-black uppercase leading-none tracking-tight text-cf-text-heading placeholder:text-cf-text-3/50 focus:outline-none"
        placeholder="Заголовок новости"
      />

      {/* Meta fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-3">Раздел</span>
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            onBlur={handleFieldChange}
            placeholder="dispatch / заметки / маршруты"
            className="w-full border border-cf-text-1/12 bg-cf-bg-2 px-3 py-2 text-sm text-cf-text-1 placeholder:text-cf-text-4 focus:border-cf-warm/40 focus:outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-3">Тег</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onBlur={handleFieldChange}
            placeholder="необязательно"
            className="w-full border border-cf-text-1/12 bg-cf-bg-2 px-3 py-2 text-sm text-cf-text-1 placeholder:text-cf-text-4 focus:border-cf-warm/40 focus:outline-none"
          />
        </label>
      </div>

      {/* Cover image */}
      <div className="space-y-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-3">Обложка</span>
        <CoverImageUploader
          value={coverImage || null}
          onChange={(url) => {
            setCoverImage(url ?? '')
            handleFieldChange()
          }}
        />
      </div>

      {/* Tiptap editor with toolbar */}
      {editor && (
        <>
          {/* Static toolbar */}
          <div className="sticky top-14 z-40 flex items-center gap-0.5 rounded-md border border-cf-text-1/10 bg-cf-bg-2/95 px-1.5 py-1.5 backdrop-blur-xl">
            <ToolbarBtn
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Жирный"
            >
              <Bold className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Курсив"
            >
              <Italic className="h-4 w-4" />
            </ToolbarBtn>
            <span className="mx-0.5 h-4 w-px shrink-0 bg-cf-text-1/15" />
            <ToolbarBtn
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Заголовок H2"
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Заголовок H3"
            >
              <Heading3 className="h-4 w-4" />
            </ToolbarBtn>
            <span className="mx-0.5 h-4 w-px shrink-0 bg-cf-text-1/15" />
            <ToolbarBtn
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Цитата"
            >
              <Quote className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Список"
            >
              <List className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Нумерованный список"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarBtn>
            <span className="mx-0.5 h-4 w-px shrink-0 bg-cf-text-1/15" />
            <ToolbarBtn onClick={addLink} active={editor.isActive('link')} title="Ссылка">
              <LinkIcon className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={addImage} title="Изображение">
              <ImageIcon className="h-4 w-4" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Разделитель"
            >
              <Minus className="h-4 w-4" />
            </ToolbarBtn>
          </div>

          {/* Bubble menu */}
          <BubbleMenu editor={editor}>
            <div className="flex items-center gap-0.5 rounded-md border border-cf-text-1/20 bg-cf-bg-2 px-1 py-1 shadow-xl shadow-black/40">
              <ToolbarBtn
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Жирный"
              >
                <Bold className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Курсив"
              >
                <Italic className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <span className="mx-0.5 h-4 w-px shrink-0 bg-cf-text-1/15" />
              <ToolbarBtn
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="H2"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive('link')}
                onClick={addLink}
                title="Ссылка"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </div>
          </BubbleMenu>
        </>
      )}

      <EditorContent editor={editor} />

      {/* Bottom: status controls + delete */}
      <div className="mt-12 border-t border-cf-text-1/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-3">
              Статус:
            </span>
            <div className="flex gap-1">
              {(['draft', 'published', 'archived'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={statusUpdating || status === s}
                  onClick={() => handleStatusChange(s)}
                  className={[
                    'h-9 px-3 text-xs font-black uppercase tracking-[0.08em] transition-colors',
                    status === s
                      ? 'bg-cf-accent text-white'
                      : 'border border-cf-text-1/15 text-cf-text-3 hover:border-cf-text-1/30 hover:text-cf-text-1',
                    statusUpdating ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {s === 'draft' ? 'Черновик' : s === 'published' ? 'Опубликовать' : 'Архив'}
                </button>
              ))}
            </div>
          </div>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cf-text-3">Удалить безвозвратно?</span>
              <button
                type="button"
                onClick={handleDelete}
                className="h-9 px-3 bg-cf-accent text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-cf-accent-hover"
              >
                Да, удалить
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-9 px-3 border border-cf-text-1/15 text-xs font-black uppercase tracking-[0.08em] text-cf-text-3 hover:border-cf-text-1/30 hover:text-cf-text-1"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex h-9 items-center gap-2 border border-cf-text-1/15 px-3 text-xs font-black uppercase tracking-[0.08em] text-cf-text-3 transition-colors hover:border-cf-accent/40 hover:text-cf-accent"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
