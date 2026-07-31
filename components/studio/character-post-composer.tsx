'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import { ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createCharacterPostAction,
  updateCharacterPostAction,
} from '@/lib/actions/studio-characters'
import type { CharacterPost } from '@/lib/types'

interface CharacterPostComposerProps {
  characterId: string
  post?: CharacterPost | null
}

export function CharacterPostComposer({ characterId, post }: CharacterPostComposerProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(post?.image_url ?? null)
  const [removedImage, setRemovedImage] = useState(false)

  const isEditing = Boolean(post)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setRemovedImage(false)
  }

  function handleRemoveImage() {
    setImagePreview(null)
    setRemovedImage(true)
  }

  async function handleSubmit(formData: FormData) {
    if (removedImage) formData.set('remove_image', 'true')
    setSaving(true)
    try {
      if (isEditing && post) {
        await updateCharacterPostAction(post.id, formData)
      } else {
        await createCharacterPostAction(characterId, formData)
      }
      toast.success(isEditing ? 'Пост обновлён' : 'Пост создан')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6">
      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="post_type" className="text-gray-600">Тип</Label>
          <Select name="post_type" defaultValue={post?.post_type ?? 'thought'}>
            <SelectTrigger id="post_type" className="bg-white/60 border-white/70 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thought">Мысль</SelectItem>
              <SelectItem value="announcement">Анонс</SelectItem>
              <SelectItem value="question">Вопрос</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content" className="text-gray-600">Текст поста</Label>
          <Textarea
            id="content"
            name="content"
            rows={6}
            defaultValue={post?.content ?? ''}
            required
            placeholder="Что хочет сказать персонаж?"
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-600">Изображение</Label>
          {imagePreview ? (
            <div className="relative inline-block">
              <Image
                src={imagePreview}
                alt="Preview"
                width={512}
                height={512}
                className="max-h-64 w-auto rounded-xl border border-white/70 object-contain"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -right-2 -top-2 h-7 w-7 rounded-xl"
                onClick={handleRemoveImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <label className="flex h-32 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm transition-colors hover:border-violet-200 hover:bg-violet-50/30">
              <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                <ImageIcon className="h-6 w-6" />
                <span>Загрузить изображение</span>
              </div>
              <input
                type="file"
                name="image_file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scheduled_at" className="text-gray-600">
            Запланировать публикацию (опционально)
          </Label>
          <Input
            id="scheduled_at"
            name="scheduled_at"
            type="datetime-local"
            defaultValue={
              post?.scheduled_at
                ? new Date(post.scheduled_at).toISOString().slice(0, 16)
                : ''
            }
            className="bg-white/60 border-white/70 rounded-xl"
          />
          <p className="text-xs text-gray-400">
            Оставьте пустым, чтобы опубликовать сразу
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/studio/characters/${characterId}`)}
            className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80"
          >
            Отмена
          </Button>
          <Button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
            {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Опубликовать'}
          </Button>
        </div>
      </form>
    </div>
  )
}