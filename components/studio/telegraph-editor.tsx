'use client'

import { forwardRef, useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
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
} from 'lucide-react'

interface TelegraphEditorProps {
  initialTitle: string
  initialContent: string | null
  onDraftChange: (patch: { title?: string; content?: string }) => void
  onContentUpdate?: () => void
  onEditorReady?: (editor: Editor) => void
}

function BubbleBtn({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={[
        'flex h-7 w-7 items-center justify-center rounded transition-colors',
        active
          ? 'bg-cf-accent/15 text-cf-accent'
          : 'text-cf-text-2 hover:bg-cf-text-1/10 hover:text-cf-text-1',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function BubbleDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-cf-text-1/15" />
}

export const TelegraphEditor = forwardRef<HTMLDivElement, TelegraphEditorProps>(
  function TelegraphEditor(
    { initialTitle, initialContent, onDraftChange, onContentUpdate, onEditorReady },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        Placeholder.configure({
          placeholder: 'Начните писать...',
        }),
        TiptapLink.configure({
          openOnClick: false,
          HTMLAttributes: { class: 'text-cf-warm underline underline-offset-2' },
        }),
        TiptapImage.configure({
          HTMLAttributes: { class: 'rounded-sm max-w-full mx-auto my-6' },
        }),
      ],
      content: initialContent ?? '',
      editorProps: {
        attributes: {
          class:
            'prose prose-lg max-w-none focus:outline-none min-h-[60vh] py-4 prose-headings:text-cf-text-heading prose-headings:font-black prose-headings:uppercase prose-p:mb-5 prose-p:text-cf-text-caption prose-p:leading-8 prose-blockquote:border-l-cf-accent prose-blockquote:text-cf-text-2 prose-strong:text-cf-text-1 prose-em:text-cf-text-2',
        },
      },
      onUpdate: ({ editor }) => {
        onDraftChange({ content: editor.getHTML() })
        onContentUpdate?.()
      },
    })

    useEffect(() => {
      if (editor && editor.getHTML() !== (initialContent ?? '')) {
        editor.commands.setContent(initialContent ?? '', { emitUpdate: false })
      }
    }, [editor, initialContent])

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

    const setRefs = useCallback(
      (el: HTMLDivElement | null) => {
        containerRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      },
      [ref],
    )

    useEffect(() => {
      if (editor && onEditorReady) onEditorReady(editor)
    }, [editor, onEditorReady])

    if (!editor) return null

    return (
      <div ref={setRefs} className="relative mx-auto max-w-2xl">
        {/* Title */}
        <input
          value={initialTitle}
          onChange={(e) => onDraftChange({ title: e.target.value })}
          className="mb-1 w-full bg-transparent text-3xl font-black uppercase leading-none tracking-tight text-cf-text-heading placeholder:text-cf-text-3/50 focus:outline-none"
          placeholder="Заголовок главы"
        />
        <div className="mb-8 h-px bg-cf-text-1/10" />

        {/* Bubble formatting menu */}
        <BubbleMenu editor={editor}>
          <div className="flex items-center gap-0.5 rounded-md border border-cf-text-1/20 bg-cf-bg-2 px-1 py-1 shadow-xl shadow-black/40">
            <BubbleBtn
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Жирный"
            >
              <Bold className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Курсив"
            >
              <Italic className="h-3.5 w-3.5" />
            </BubbleBtn>

            <BubbleDivider />

            <BubbleBtn
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Заголовок H2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Заголовок H3"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </BubbleBtn>

            <BubbleDivider />

            <BubbleBtn
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Цитата"
            >
              <Quote className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Список"
            >
              <List className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Нумерованный список"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </BubbleBtn>

            <BubbleDivider />

            <BubbleBtn
              active={editor.isActive('link')}
              onClick={addLink}
              title="Ссылка"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn onClick={addImage} title="Изображение">
              <ImageIcon className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Разделитель"
            >
              <Minus className="h-3.5 w-3.5" />
            </BubbleBtn>
          </div>
        </BubbleMenu>

        <EditorContent editor={editor} />
      </div>
    )
  },
)
