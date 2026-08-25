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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createCharacterAction,
  updateCharacterAction,
} from '@/lib/actions/studio-characters'
import type { Character } from '@/lib/types'

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

interface CharacterFormProps {
  character?: Character | null
}

export function CharacterForm({ character }: CharacterFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(character?.name ?? '')
  const [slug, setSlug] = useState(character?.slug ?? '')

  const isEditing = Boolean(character)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    try {
      if (isEditing && character) {
        await updateCharacterAction(character.id, formData)
      } else {
        await createCharacterAction(formData)
      }
      toast.success(isEditing ? 'Сохранено' : 'Персонаж создан')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6">
      <form action={handleSubmit} className="space-y-5">
        <input type="hidden" name="character_type" value="person" />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-600">Имя</Label>
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
          <Label htmlFor="avatar" className="text-gray-600">Avatar URL</Label>
          <Input
            id="avatar"
            name="avatar"
            type="url"
            defaultValue={character?.avatar ?? ''}
            placeholder="https://..."
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio" className="text-gray-600">Краткое описание</Label>
          <Textarea
            id="bio"
            name="bio"
            rows={3}
            defaultValue={character?.bio ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_description" className="text-gray-600">Полное описание</Label>
          <Textarea
            id="full_description"
            name="full_description"
            rows={8}
            defaultValue={character?.full_description ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="abilities" className="text-gray-600">Способности (по одной на строку)</Label>
          
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reply_mode" className="text-gray-600">Режим ответов</Label>
            <Select name="reply_mode" defaultValue={character?.reply_mode ?? 'ai_auto'}>
              <SelectTrigger id="reply_mode" className="bg-white/60 border-white/70 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai_auto">AI автоматически</SelectItem>
                <SelectItem value="manual">Вручную</SelectItem>
                <SelectItem value="hybrid">AI + подтверждение</SelectItem>
                <SelectItem value="disabled">Отключено</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="can_receive_messages" className="text-gray-600">Принимает сообщения</Label>
            <Select
              name="can_receive_messages"
              defaultValue={character?.can_receive_messages === false ? 'false' : 'true'}
            >
              <SelectTrigger id="can_receive_messages" className="bg-white/60 border-white/70 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Да</SelectItem>
                <SelectItem value="false">Нет</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="speaking_style" className="text-gray-600">Манера речи</Label>
          <Textarea
            id="speaking_style"
            name="speaking_style"
            rows={3}
            defaultValue={character?.speaking_style ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="personality" className="text-gray-600">Характер</Label>
          <Textarea
            id="personality"
            name="personality"
            rows={3}
            defaultValue={character?.personality ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="system_role" className="text-gray-600">
            Системная инструкция
          </Label>
          <Textarea
            id="system_role"
            name="system_role"
            rows={8}
            defaultValue={character?.system_role ?? ''}
            placeholder="Вы {Имя}, ... — что и как говорит модель от лица персонажа в чате."
            className="bg-white/60 border-white/70 rounded-xl font-mono text-sm"
          />
          <p className="text-xs text-gray-400">
            Инструкция, по которой модель говорит от лица этого персонажа в чате.
            Подставляется в system-промпт вместе с био, характером и манерой речи.
            Если поле пустое — чат с персонажем отключён.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="knowledge_scope" className="text-gray-600">Границы знаний</Label>
          <Textarea
            id="knowledge_scope"
            name="knowledge_scope"
            rows={3}
            defaultValue={character?.knowledge_scope ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="spoiler_policy" className="text-gray-600">Политика спойлеров</Label>
          <Textarea
            id="spoiler_policy"
            name="spoiler_policy"
            rows={3}
            defaultValue={character?.spoiler_policy ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="boundaries" className="text-gray-600">Ограничения</Label>
          <Textarea
            id="boundaries"
            name="boundaries"
            rows={3}
            defaultValue={character?.boundaries ?? ''}
            className="bg-white/60 border-white/70 rounded-xl"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/studio/characters')}
            className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80"
          >
            Отмена
          </Button>
          <Button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
            {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </div>
  )
}
