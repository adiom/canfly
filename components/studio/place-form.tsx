'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  createPlaceAction,
  updatePlaceAction,
} from '@/lib/actions/studio-places'
import type { Place } from '@/lib/types'

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

interface PlaceFormProps {
  place?: Place | null
}

export function PlaceForm({ place }: PlaceFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(place?.name ?? '')
  const [slug, setSlug] = useState(place?.slug ?? '')

  const isEditing = Boolean(place)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    try {
      if (isEditing && place) {
        await updatePlaceAction(place.id, formData)
      } else {
        await createPlaceAction(formData)
      }
      toast.success(isEditing ? 'Сохранено' : 'Место создано')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6">
      <form action={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-600">Название места</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!slug && name) setSlug(createSlug(name))
              }}
              required
              className="bg-white/60 border-white/70 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-gray-600">Slug</Label>
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="bg-white/60 border-white/70 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar" className="text-gray-600">Изображение места</Label>
          <Input
            id="avatar"
            name="avatar"
            type="url"
            defaultValue={place?.avatar ?? ''}
            placeholder="https://..."
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="map_image_url" className="text-gray-600">Карта места (URL)</Label>
          <Input
            id="map_image_url"
            name="map_image_url"
            type="url"
            defaultValue={place?.map_image_url ?? ''}
            placeholder="https://..."
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="theme_color" className="text-gray-600">Тематический цвет</Label>
            <Input
              id="theme_color"
              name="theme_color"
              defaultValue={place?.theme_color ?? ''}
              placeholder="#..."
              className="bg-white/60 border-white/70 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="era" className="text-gray-600">Эпоха / время</Label>
            <Input
              id="era"
              name="era"
              defaultValue={place?.era ?? ''}
              placeholder="напр. 1916"
              className="bg-white/60 border-white/70 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio" className="text-gray-600">Краткое описание места</Label>
          <Textarea
            id="bio"
            name="bio"
            rows={3}
            defaultValue={place?.bio ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_description" className="text-gray-600">Полное описание места</Label>
          <Textarea
            id="full_description"
            name="full_description"
            rows={8}
            defaultValue={place?.full_description ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/studio/places')}
            className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80"
          >
            Отмена
          </Button>
          <Button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:from-emerald-700 hover:to-emerald-600">
            {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать место'}
          </Button>
        </div>
      </form>
    </div>
  )
}
