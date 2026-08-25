'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { HomepageSlide, HomepageSlideTheme } from '@/lib/types'
import { createSlideAction, updateSlideAction } from '@/lib/actions/admin-slides'

interface HomepageSlideFormProps {
  slide?: HomepageSlide
}

const emptyForm = {
  title: '',
  eyebrow: '',
  description: '',
  background_image: '',
  mobile_image: '',
  primary_cta_label: '',
  primary_cta_href: '',
  secondary_cta_label: '',
  secondary_cta_href: '',
  aside_label: '',
  aside_number: '',
  aside_text: '',
  theme: 'atelier' as HomepageSlideTheme,
  is_active: true,
  display_order: '0',
}

const themes: Array<{ value: HomepageSlideTheme; label: string }> = [
  { value: 'atelier', label: 'Ателье / ткань' },
  { value: 'night-city', label: 'Ночной город' },
  { value: 'pvz', label: 'ПВЗ / логистика' },
  { value: 'volga', label: 'Волга / инженерия' },
  { value: 'dreams', label: 'Мир Снов' },
]

export function HomepageSlideForm({ slide }: HomepageSlideFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const isEditing = Boolean(slide)

  const [form, setForm] = useState(() => {
    if (!slide) return emptyForm
    return {
      title: slide.title || '',
      eyebrow: slide.eyebrow || '',
      description: slide.description || '',
      background_image: slide.background_image || '',
      mobile_image: slide.mobile_image || '',
      primary_cta_label: slide.primary_cta_label || '',
      primary_cta_href: slide.primary_cta_href || '',
      secondary_cta_label: slide.secondary_cta_label || '',
      secondary_cta_href: slide.secondary_cta_href || '',
      aside_label: slide.aside_label || '',
      aside_number: slide.aside_number || '',
      aside_text: slide.aside_text || '',
      theme: slide.theme || 'atelier',
      is_active: Boolean(slide.is_active),
      display_order:
        slide.display_order === null || slide.display_order === undefined
          ? '0'
          : String(slide.display_order),
    }
  })

  const updateField = <Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)
    formData.set('is_active', form.is_active ? 'on' : '')
    formData.set('display_order', form.display_order)

    startTransition(async () => {
      const result = isEditing
        ? await updateSlideAction(slide!.id, formData)
        : await createSlideAction(formData)

      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }

      router.push('/admin/slider')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/70 p-6">
      {error ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Заголовок</span>
          <Input
            name="title"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            required
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Порядок</span>
          <Input
            name="display_order"
            type="number"
            value={form.display_order}
            onChange={(event) => updateField('display_order', event.target.value)}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Eyebrow / рубрика</span>
          <Input
            name="eyebrow"
            value={form.eyebrow}
            onChange={(event) => updateField('eyebrow', event.target.value)}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Тема оформления</span>
          <select
            name="theme"
            value={form.theme}
            onChange={(event) => updateField('theme', event.target.value as HomepageSlideTheme)}
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            {themes.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-2 text-sm text-slate-300">
        <span>Описание</span>
        <Textarea
          name="description"
          value={form.description}
          onChange={(event) => updateField('description', event.target.value)}
          rows={5}
          className="border-slate-700 bg-slate-950 text-white"
        />
      </label>

      <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Правая колонка (только большие экраны)
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Подпись над номером</span>
            <Input
              name="aside_label"
              value={form.aside_label}
              onChange={(event) => updateField('aside_label', event.target.value)}
              placeholder="featured"
              className="border-slate-700 bg-slate-950 text-white"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Номер (необязательно)</span>
            <Input
              name="aside_number"
              value={form.aside_number}
              onChange={(event) => updateField('aside_number', event.target.value)}
              placeholder="01 — иначе по порядку слайда"
              className="border-slate-700 bg-slate-950 text-white"
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm text-slate-300">
          <span>Текст под номером</span>
          <Textarea
            name="aside_text"
            value={form.aside_text}
            onChange={(event) => updateField('aside_text', event.target.value)}
            rows={3}
            placeholder="Короткий текст для боковой колонки"
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Фоновое изображение URL</span>
          <Input
            name="background_image"
            value={form.background_image}
            onChange={(event) => updateField('background_image', event.target.value)}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Мобильное изображение URL</span>
          <Input
            name="mobile_image"
            value={form.mobile_image}
            onChange={(event) => updateField('mobile_image', event.target.value)}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Основная кнопка</span>
          <Input
            name="primary_cta_label"
            value={form.primary_cta_label}
            onChange={(event) => updateField('primary_cta_label', event.target.value)}
            placeholder="Читать"
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Ссылка основной кнопки</span>
          <Input
            name="primary_cta_href"
            value={form.primary_cta_href}
            onChange={(event) => updateField('primary_cta_href', event.target.value)}
            placeholder="/release/..."
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Вторичная кнопка</span>
          <Input
            name="secondary_cta_label"
            value={form.secondary_cta_label}
            onChange={(event) => updateField('secondary_cta_label', event.target.value)}
            placeholder="Подробнее"
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-300">
          <span>Ссылка вторичной кнопки</span>
          <Input
            name="secondary_cta_href"
            value={form.secondary_cta_href}
            onChange={(event) => updateField('secondary_cta_href', event.target.value)}
            placeholder="/characters"
            className="border-slate-700 bg-slate-950 text-white"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => updateField('is_active', event.target.checked)}
          className="size-4 rounded border-slate-700 bg-slate-950"
        />
        Активен на главной
      </label>

      <div className="flex justify-end gap-3 border-t border-slate-800 pt-6">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/slider')}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} className="bg-purple-600 hover:bg-purple-700">
          {pending ? 'Сохранение...' : 'Сохранить слайд'}
        </Button>
      </div>
    </form>
  )
}
