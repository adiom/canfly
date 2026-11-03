'use client'

import { useRouter } from 'next/navigation'
import type { Release } from '@/lib/releases-types'
import { useReleaseForm } from '@/components/studio/use-release-form'
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
  const form = useReleaseForm(release)
  const { draft, update, saving } = form

  return (
    <form onSubmit={form.save} aria-busy={saving}>
      <div className="border border-cf-text-1/10 bg-cf-bg-2 p-5 md:p-6">
        {!isEdit && (
          <h2 className="mb-6 font-[family-name:var(--font-cormorant)] text-3xl font-bold italic leading-none text-cf-text-heading">
            Новый релиз
          </h2>
        )}
        <fieldset className="space-y-5" disabled={saving}>
          <div className="space-y-1">
            <Label htmlFor="title" className={labelCls}>Название</Label>
            <Input id="title" value={draft.title} onChange={e => form.changeTitle(e.target.value)} required maxLength={300} placeholder="Название произведения" className={fieldCls} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="slug" className={labelCls}>Slug</Label>
            <Input id="slug" value={draft.slug} onChange={e => form.changeSlug(e.target.value)} required placeholder="url-slug" className={fieldCls} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className={labelCls}>Описание</Label>
            <Textarea id="description" value={draft.description} onChange={e => update('description', e.target.value)} rows={4} placeholder="Краткое описание" className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-cf-text-1/10 pt-5">
            <div className="space-y-1">
              <Label htmlFor="genre" className={labelCls}>Жанр</Label>
              <Input id="genre" value={draft.genre} onChange={e => update('genre', e.target.value)} placeholder="Фантастика" className={fieldCls} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="release_date" className={labelCls}>Дата выпуска</Label>
              <Input id="release_date" type="date" value={draft.release_date} onChange={e => update('release_date', e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="isbn" className={labelCls}>ISBN</Label>
              <Input id="isbn" value={draft.isbn} onChange={e => update('isbn', e.target.value)} placeholder="978-..." className={fieldCls} />
            </div>
            <div className="space-y-1">
              <Label className={labelCls}>Обложка</Label>
              <CoverImageUploader value={draft.cover_image || null} onChange={url => update('cover_image', url ?? '')} disabled={saving} onUploadingChange={form.setUploading} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="annotation" className={labelCls}>Аннотация</Label>
            <Textarea id="annotation" value={draft.annotation} onChange={e => update('annotation', e.target.value)} rows={3} placeholder="Аннотация для читателей" className={fieldCls} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="editor_notes" className={labelCls}>Заметки редактора</Label>
            <Textarea id="editor_notes" value={draft.editor_notes} onChange={e => update('editor_notes', e.target.value)} rows={2} placeholder="Внутренние заметки" className={fieldCls} />
          </div>

          <div className="space-y-2 border-t border-cf-text-1/10 pt-5">
            <label className="flex items-center gap-2 text-sm text-cf-text-2">
              <input
                type="checkbox"
                checked={draft.show_in_catalog}
                onChange={e => update('show_in_catalog', e.target.checked)}
                className="size-4 rounded accent-cf-accent"
              />
              Показывать в каталоге релизов
            </label>
            <p className="text-xs leading-relaxed text-cf-text-3">
              Релиз останется доступным по прямой ссылке и в поиске — флаг влияет
              только на страницу всех релизов /releases.
            </p>
          </div>

          {form.error && <p role="alert" className="text-sm text-cf-accent">{form.error}</p>}
          <div className="flex gap-3 border-t border-cf-text-1/10 pt-5">
            <button
              type="submit"
              disabled={saving || form.uploading}
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
        </fieldset>
      </div>
    </form>
  )
}
