'use client'

import { useState, type FormEvent } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { toast } from 'sonner'
import type { Release } from '@/lib/releases-types'
import { generateSlug } from '@/lib/slug-utils'
import { createReleaseAction, updateReleaseAction } from '@/lib/actions/studio'

export interface ReleaseDraft {
  title: string
  slug: string
  description: string
  genre: string
  cover_image: string
  release_date: string
  isbn: string
  annotation: string
  editor_notes: string
  show_in_catalog: boolean
}

function initialDraft(release?: Release | null): ReleaseDraft {
  return {
    title: release?.title ?? '',
    slug: release?.slug ?? '',
    description: release?.description ?? '',
    genre: release?.genre ?? '',
    cover_image: release?.cover_image ?? '',
    // SQL DATE приходит из репозитория как YYYY-MM-DD, без часового пояса.
    release_date: release?.release_date?.slice(0, 10) ?? '',
    isbn: release?.isbn ?? '',
    annotation: release?.annotation ?? '',
    editor_notes: release?.editor_notes ?? '',
    show_in_catalog: release?.show_in_catalog ?? true,
  }
}

export function useReleaseForm(release?: Release | null) {
  const [draft, setDraft] = useState(() => initialDraft(release))
  const [baseline, setBaseline] = useState(draft)
  const [slugManual, setSlugManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)

  function update<K extends keyof ReleaseDraft>(key: K, value: ReleaseDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }))
    setError(null)
  }

  function changeTitle(title: string) {
    setDraft(previous => ({
      ...previous,
      title,
      ...(!release && !slugManual ? { slug: generateSlug(title) } : {}),
    }))
    setError(null)
  }

  function changeSlug(slug: string) {
    setSlugManual(true)
    update('slug', slug)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || uploading) return
    if (!draft.title.trim() || !draft.slug.trim()) {
      setError('Название и адрес страницы обязательны')
      return
    }

    const submitted = { ...draft }
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      for (const [key, value] of Object.entries(submitted)) {
        formData.set(key, String(value))
      }
      // Авторы не редактируются в этой форме, поэтому сохраняем их данные.
      formData.set('authors', JSON.stringify(release?.authors ?? []))
      if (release) {
        // Статус берём из последних серверных props, а не из снимка формы.
        formData.set('status', release.status)
        await updateReleaseAction(release.id, formData)
        setBaseline(submitted)
        setSaved(true)
        toast.success('Основные данные сохранены')
      } else {
        await createReleaseAction(formData)
      }
    } catch (cause) {
      unstable_rethrow(cause)
      setError('Не удалось сохранить основные данные. Проверьте поля и повторите попытку.')
    } finally {
      setSaving(false)
    }
  }

  return {
    draft, dirty, saving, uploading, error, saved,
    update, changeTitle, changeSlug, save, setUploading,
  }
}

export type ReleaseFormController = ReturnType<typeof useReleaseForm>
