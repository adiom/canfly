'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import type { Release } from '@/lib/releases-types'
import { generateSlug } from '@/lib/slug-utils'
import { createReleaseAction, updateReleaseAction } from '@/lib/actions/studio'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CoverImageUploader } from '@/components/studio/cover-image-uploader'

interface ReleaseFormProps {
  release?: Release | null
}

const fieldCls =
  'rounded-none border-cf-text-1/15 bg-cf-bg text-cf-text-1 focus-visible:border-cf-text-1/30 focus-visible:ring-cf-text-1/20'

const labelCls =
  'inline-block mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cf-text-3'

export function ReleaseForm({ release }: ReleaseFormProps) {
  const router = useRouter()
  const isEdit = !!release
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState(release?.title ?? '')
  const [slug, setSlug] = useState(release?.slug ?? '')
  const [description, setDescription] = useState(release?.description ?? '')
  const [genre, setGenre] = useState(release?.genre ?? '')
  const [coverImage, setCoverImage] = useState(release?.cover_image ?? '')
  const [releaseDate, setReleaseDate] = useState(
    release?.release_date
      ? new Date(release.release_date).toISOString().split('T')[0]
      : ''
  )
  const [isbn, setIsbn] = useState(release?.isbn ?? '')
  const [annotation, setAnnotation] = useState(release?.annotation ?? '')
  const [editorNotes, setEditorNotes] = useState(release?.editor_notes ?? '')
  const [slugManual, setSlugManual] = useState(false)

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle)
    if (!slugManual && !isEdit) {
      setSlug(generateSlug(newTitle))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !slug.trim()) {
      toast.error('Заголовок и slug обязательны')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.set('title', title)
      formData.set('slug', slug)
      formData.set('description', description)
      formData.set('cover_image', coverImage)
      formData.set('genre', genre)
      formData.set('release_date', releaseDate)
      formData.set('isbn', isbn)
      formData.set('annotation', annotation)
      formData.set('editor_notes', editorNotes)
      formData.set('authors', JSON.stringify([]))
      if (isEdit) {
        formData.set('status', release!.status)
        await updateReleaseAction(release!.id, formData)
        toast.success('Сохранено')
      } else {
        await createReleaseAction(formData)
      }
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="border border-cf-text-1/10 bg-cf-bg-2 p-5 md:p-6">
        {!isEdit && (
          <h2 className="mb-6 font-[family-name:var(--font-cormorant)] text-3xl font-bold italic leading-none text-cf-text-heading">
            Новый релиз
          </h2>
        )}
        <div className="space-y-5">
          <div className="space-y-1">
            <Label htmlFor="title" className={labelCls}>Название</Label>
            <Input id="title" value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="Название произведения" className={fieldCls} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="slug" className={labelCls}>Slug</Label>
            <Input id="slug" value={slug} onChange={e => { setSlug(e.target.value); setSlugManual(true) }} placeholder="url-slug" className={fieldCls} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className={labelCls}>Описание</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Краткое описание" className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-cf-text-1/10 pt-5">
            <div className="space-y-1">
              <Label htmlFor="genre" className={labelCls}>Жанр</Label>
              <Input id="genre" value={genre} onChange={e => setGenre(e.target.value)} placeholder="Фантастика" className={fieldCls} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="release_date" className={labelCls}>Дата выпуска</Label>
              <Input id="release_date" type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="isbn" className={labelCls}>ISBN</Label>
              <Input id="isbn" value={isbn} onChange={e => setIsbn(e.target.value)} placeholder="978-..." className={fieldCls} />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>Обложка</Label>
              <CoverImageUploader value={coverImage || null} onChange={(url) => setCoverImage(url ?? '')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="annotation" className={labelCls}>Аннотация</Label>
            <Textarea id="annotation" value={annotation} onChange={e => setAnnotation(e.target.value)} rows={3} placeholder="Аннотация для читателей" className={fieldCls} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="editor_notes" className={labelCls}>Заметки редактора</Label>
            <Textarea id="editor_notes" value={editorNotes} onChange={e => setEditorNotes(e.target.value)} rows={2} placeholder="Внутренние заметки" className={fieldCls} />
          </div>

          <div className="flex gap-3 border-t border-cf-text-1/10 pt-5">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 bg-cf-accent px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e] disabled:opacity-50"
            >
              {saving ? 'Сохраняю…' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-11 items-center gap-2 border border-cf-text-1/12 bg-transparent px-5 text-sm font-black uppercase tracking-[0.08em] text-cf-text-2 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-heading"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}