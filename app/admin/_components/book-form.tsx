'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BookChapter, BookType, BookWithCharacters, Character } from '@/lib/types'
import { ChapterEditor } from './chapter-editor'
import { ComicPagesEditor } from './comic-pages-editor'

interface BookFormProps {
  bookId?: string
}

const emptyForm = {
  title: '',
  slug: '',
  type: 'comic' as BookType,
  description: '',
  cover_image: '',
  preview_pages: [] as string[],
  external_links: '{}',
  price: '',
  is_featured: false,
  display_order: '0',
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function formatLinks(value: Record<string, string> | null) {
  return JSON.stringify(value || {}, null, 2)
}

export function BookForm({ bookId }: BookFormProps) {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([])
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const isEditing = Boolean(bookId)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [charactersResponse, bookResponse] = await Promise.all([
          fetch('/api/admin/characters'),
          bookId ? fetch(`/api/admin/books/${bookId}`) : Promise.resolve(null),
        ])

        if (charactersResponse.status === 401 || bookResponse?.status === 401) {
          router.push('/admin/login')
          return
        }

        if (!charactersResponse.ok) {
          throw new Error('Не удалось загрузить персонажей')
        }

        setCharacters((await charactersResponse.json()) as Character[])

        if (bookResponse) {
          if (!bookResponse.ok) {
            throw new Error('Не удалось загрузить книгу')
          }

          const book = (await bookResponse.json()) as BookWithCharacters
          setForm({
            title: book.title || '',
            slug: book.slug || '',
            type: book.type || 'comic',
            description: book.description || '',
            cover_image: book.cover_image || '',
            preview_pages: book.preview_pages || [],
            external_links: formatLinks(book.external_links),
            price: book.price === null || book.price === undefined ? '' : String(book.price),
            is_featured: Boolean(book.is_featured),
            display_order:
              book.display_order === null || book.display_order === undefined
                ? '0'
                : String(book.display_order),
          })
          setSelectedCharacterIds(book.character_ids || [])
          setChapters(book.chapters ?? [])
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [bookId, router])

  const payload = useMemo(() => {
    let externalLinks: Record<string, string> = {}

    try {
      externalLinks = JSON.parse(form.external_links || '{}')
    } catch {
      externalLinks = {}
    }

    return {
      title: form.title,
      slug: form.slug,
      type: form.type,
      description: form.description,
      cover_image: form.cover_image,
      preview_pages: form.preview_pages,
      external_links: externalLinks,
      price: form.price ? Number(form.price) : null,
      is_featured: form.is_featured,
      display_order: form.display_order ? Number(form.display_order) : 0,
      character_ids: selectedCharacterIds,
      chapters: form.type === 'book' ? chapters : undefined,
    }
  }, [form, selectedCharacterIds, chapters])

  const updateField = <Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const toggleCharacter = (characterId: string) => {
    setSelectedCharacterIds((current) =>
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : [...current, characterId],
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      JSON.parse(form.external_links || '{}')
    } catch {
      setSaving(false)
      setError('External links должны быть валидным JSON-объектом')
      return
    }

    // Валидация глав для книг
    if (form.type === 'book') {
      const invalidChapter = chapters.some((ch) => !ch.title.trim() || !ch.content.trim())
      if (invalidChapter) {
        setSaving(false)
        setError('Все главы должны иметь заголовок и содержимое')
        return
      }
    }

    try {
      const response = await fetch(isEditing ? `/api/admin/books/${bookId}` : '/api/admin/books', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Не удалось сохранить книгу')
      }

      router.push('/admin')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-400">Загрузка...</p>
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/70 p-6">
      {error ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Название</span>
          <Input
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            onBlur={() => {
              if (!form.slug) updateField('slug', createSlug(form.title))
            }}
            required
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Slug</span>
          <Input
            value={form.slug}
            onChange={(event) => updateField('slug', event.target.value)}
            required
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Тип</span>
          <select
            value={form.type}
            onChange={(event) => updateField('type', event.target.value as BookType)}
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <option value="comic">Комикс</option>
            <option value="book">Книга</option>
            <option value="audiobook">Аудиокнига</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Цена</span>
          <Input
            type="number"
            min="0"
            step="1"
            value={form.price}
            onChange={(event) => updateField('price', event.target.value)}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Порядок</span>
          <Input
            type="number"
            value={form.display_order}
            onChange={(event) => updateField('display_order', event.target.value)}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={form.is_featured}
          onChange={(event) => updateField('is_featured', event.target.checked)}
          className="size-4 rounded border-slate-700 bg-slate-950"
        />
        Показывать в избранном
      </label>

      <label className="space-y-2 text-sm text-slate-300">
        <span>Cover image URL</span>
        <Input
          value={form.cover_image}
          onChange={(event) => updateField('cover_image', event.target.value)}
          className="border-slate-700 bg-slate-950 text-white"
        />
      </label>

      <label className="space-y-2 text-sm text-slate-300">
        <span>Описание</span>
        <Textarea
          value={form.description}
          onChange={(event) => updateField('description', event.target.value)}
          rows={6}
          className="border-slate-700 bg-slate-950 text-white"
        />
      </label>

      <div className="space-y-3 text-sm text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <span>Персонажи в книге</span>
          <span className="text-xs text-slate-500">Выбрано: {selectedCharacterIds.length}</span>
        </div>

        {characters.length > 0 ? (
          <div className="grid max-h-72 gap-2 overflow-y-auto rounded-md border border-slate-800 bg-slate-950 p-3 md:grid-cols-2">
            {characters.map((character) => (
              <label
                key={character.id}
                className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-slate-300 hover:bg-slate-900"
              >
                <input
                  type="checkbox"
                  checked={selectedCharacterIds.includes(character.id)}
                  onChange={() => toggleCharacter(character.id)}
                  className="mt-1 size-4 rounded border-slate-700 bg-slate-950"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-white">{character.name}</span>
                  <span className="block truncate text-xs text-slate-500">/{character.slug}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-4 text-slate-500">
            Персонажи пока не добавлены.
          </div>
        )}
      </div>

      {form.type === 'book' ? (
        <div className="space-y-2">
          <ChapterEditor chapters={chapters} onChange={setChapters} />
        </div>
      ) : (
        <div className="space-y-2">
          <ComicPagesEditor
            bookId={bookId || 'new'}
            initialPages={form.preview_pages}
            onUpdate={(pages) => updateField('preview_pages', pages)}
          />
        </div>
      )}

      <label className="space-y-2 text-sm text-slate-300">
        <span>External links JSON</span>
        <Textarea
          value={form.external_links}
          onChange={(event) => updateField('external_links', event.target.value)}
          rows={6}
          className="border-slate-700 bg-slate-950 font-mono text-sm text-white"
        />
      </label>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/admin')}>
          Отмена
        </Button>
        <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700">
          {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  )
}
