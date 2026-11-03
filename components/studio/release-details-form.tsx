'use client'

import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ReleaseSaveBar } from '@/components/studio/release-save-bar'
import type { ReleaseFormController } from '@/components/studio/use-release-form'

export function ReleaseDetailsForm({ form, disabled }: { form: ReleaseFormController; disabled: boolean }) {
  const { draft, update } = form

  return (
    <form onSubmit={event => { if (disabled) event.preventDefault(); else void form.save(event) }} aria-label="Основные данные" aria-busy={form.saving}>
      <fieldset disabled={form.saving || disabled}>
        <div className="paper-field paper-title-field">
          <Label htmlFor="release-title">Название</Label>
          <Input id="release-title" name="title" value={draft.title} onChange={event => form.changeTitle(event.target.value)} required maxLength={300} placeholder="Название произведения" />
        </div>
        <div className="paper-field">
          <Label htmlFor="release-slug">Адрес страницы</Label>
          <div className="paper-slug">
            <span aria-hidden="true">/release/</span>
            <Input id="release-slug" name="slug" value={draft.slug} onChange={event => form.changeSlug(event.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Латинские буквы, цифры и дефисы" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
        </div>
        <div className="paper-field">
          <Label htmlFor="release-description">Описание</Label>
          <Textarea id="release-description" name="description" value={draft.description} onChange={event => update('description', event.target.value)} rows={4} placeholder="Короткое описание для карточки релиза" />
        </div>
        <div className="paper-field-row">
          <div className="paper-field">
            <Label htmlFor="release-genre">Жанр</Label>
            <Input id="release-genre" name="genre" value={draft.genre} onChange={event => update('genre', event.target.value)} placeholder="Например, современная проза" />
          </div>
          <div className="paper-field">
            <Label htmlFor="release-date">Дата выпуска</Label>
            <Input id="release-date" name="release_date" type="date" value={draft.release_date} onChange={event => update('release_date', event.target.value)} />
          </div>
        </div>
        <details className="paper-details">
          <summary>Аннотация и заметки<ChevronDown className="size-4" aria-hidden="true" /></summary>
          <div className="paper-details-body">
            <div className="paper-field">
              <Label htmlFor="release-annotation">Аннотация</Label>
              <Textarea id="release-annotation" name="annotation" value={draft.annotation} onChange={event => update('annotation', event.target.value)} rows={5} placeholder="Полное описание для читателя" />
            </div>
            <div className="paper-field">
              <Label htmlFor="release-notes">Заметки редактора</Label>
              <Textarea id="release-notes" name="editor_notes" value={draft.editor_notes} onChange={event => update('editor_notes', event.target.value)} rows={3} placeholder="Внутренние заметки" aria-describedby="release-notes-help" />
            </div>
            <p id="release-notes-help" className="paper-help">Заметки видны только в Студии.</p>
          </div>
        </details>
        <details className="paper-details">
          <summary>ISBN и каталог<ChevronDown className="size-4" aria-hidden="true" /></summary>
          <div className="paper-details-body">
            <div className="paper-field">
              <Label htmlFor="release-isbn">ISBN</Label>
              <Input id="release-isbn" name="isbn" value={draft.isbn} onChange={event => update('isbn', event.target.value)} placeholder="Не указан" />
            </div>
            <label className="paper-check">
              <input type="checkbox" name="show_in_catalog" checked={draft.show_in_catalog} onChange={event => update('show_in_catalog', event.target.checked)} />
              Показывать в каталоге
            </label>
            <p className="paper-help mt-2">Опубликованный релиз останется доступен по прямой ссылке и в поиске.</p>
          </div>
        </details>
      </fieldset>
      <ReleaseSaveBar {...form} label="Сохранить основные" disabled={disabled} />
    </form>
  )
}
