'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, TriangleAlert, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CoverImageUploader } from '@/components/studio/cover-image-uploader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createGameAction, updateGameAction } from '@/lib/actions/studio-games'
import type { Game, GameAspectRatio, Release } from '@/lib/releases-types'
import { generateSlug } from '@/lib/slug-utils'
import type { Character } from '@/lib/types'

const ASPECT_RATIO_LABEL: Record<GameAspectRatio, string> = {
  '16:9': '16:9 — горизонтальная',
  '4:3': '4:3 — классическая',
  '1:1': '1:1 — квадрат',
  '9:16': '9:16 — вертикальная',
}

type FileStatus = 'unknown' | 'checking' | 'ok' | 'missing'

interface GameFormProps {
  game?: Game | null
  allCharacters?: Character[]
  allReleases?: Release[]
  linkedCharacterIds?: string[]
  linkedReleaseIds?: string[]
}

/**
 * Игра не загружается в canfly: файлы лежат в `public/games/<slug>/`. Поэтому
 * форма проверяет, что папка со слагом реально существует, и не даёт
 * опубликовать игру со сломанной ссылкой.
 */
export function GameForm({
  game,
  allCharacters = [],
  allReleases = [],
  linkedCharacterIds = [],
  linkedReleaseIds = [],
}: GameFormProps) {
  const router = useRouter()
  const isEditing = Boolean(game)

  const [title, setTitle] = useState(game?.title ?? '')
  const [slug, setSlug] = useState(game?.slug ?? '')
  const [slugManual, setSlugManual] = useState(isEditing)
  const [tagline, setTagline] = useState(game?.tagline ?? '')
  const [description, setDescription] = useState(game?.description ?? '')
  const [coverImage, setCoverImage] = useState(game?.cover_image ?? '')
  const [aspectRatio, setAspectRatio] = useState<GameAspectRatio>(game?.aspect_ratio ?? '16:9')
  const [displayOrder, setDisplayOrder] = useState(String(game?.display_order ?? 0))
  const [isPublished, setIsPublished] = useState(game?.is_published ?? false)
  const [characterIds, setCharacterIds] = useState<string[]>(linkedCharacterIds)
  const [releaseIds, setReleaseIds] = useState<string[]>(linkedReleaseIds)

  const [saving, setSaving] = useState(false)
  const [fileStatus, setFileStatus] = useState<FileStatus>('unknown')

  const checkFile = useCallback(async (value: string) => {
    setFileStatus('checking')
    try {
      const response = await fetch(`/games/${value}/index.html`, { method: 'HEAD' })
      setFileStatus(response.ok ? 'ok' : 'missing')
    } catch {
      setFileStatus('missing')
    }
  }, [])

  useEffect(() => {
    // Проверка уходит в таймер: setState прямо в теле эффекта вызывал бы
    // каскадный рендер на каждое нажатие клавиши.
    const timer = setTimeout(() => {
      const clean = slug.trim()
      if (!clean) {
        setFileStatus('unknown')
        return
      }
      void checkFile(clean)
    }, 400)
    return () => clearTimeout(timer)
  }, [slug, checkFile])

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugManual) setSlug(generateSlug(value))
  }

  function toggle(list: string[], setList: (next: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id])
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()

    if (!title.trim() || !slug.trim()) {
      toast.error('Название и slug обязательны')
      return
    }
    if (isPublished && fileStatus === 'missing') {
      toast.error(`Файл /games/${slug}/index.html не найден — публикация невозможна`)
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.set('title', title)
      formData.set('slug', slug)
      formData.set('tagline', tagline)
      formData.set('description', description)
      formData.set('cover_image', coverImage)
      formData.set('aspect_ratio', aspectRatio)
      formData.set('display_order', displayOrder)
      if (isPublished) formData.set('is_published', 'true')
      for (const id of characterIds) formData.append('character_ids', id)
      for (const id of releaseIds) formData.append('release_ids', id)

      if (isEditing && game) {
        await updateGameAction(game.id, formData)
        toast.success('Сохранено')
      } else {
        await createGameAction(formData)
      }
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5 backdrop-blur-md md:p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-600">
              Название игры
            </Label>
            <Input
              id="title"
              value={title}
              onChange={event => handleTitleChange(event.target.value)}
              required
              className="rounded-xl border-white/70 bg-white/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-gray-600">
              Slug (= имя папки в public/games)
            </Label>
            <Input
              id="slug"
              value={slug}
              onChange={event => {
                setSlugManual(true)
                setSlug(event.target.value)
              }}
              required
              className="rounded-xl border-white/70 bg-white/60"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[13px]">
          {fileStatus === 'checking' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-gray-500">Проверяем файл...</span>
            </>
          ) : null}
          {fileStatus === 'ok' ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-gray-600">
                Файл найден: <code className="text-gray-500">/games/{slug}/index.html</code>
              </span>
            </>
          ) : null}
          {fileStatus === 'missing' ? (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-gray-600">
                Файла <code className="text-gray-500">/games/{slug}/index.html</code> нет — положите папку игры в
                <code className="ml-1 text-gray-500">public/games/{slug}/</code>
              </span>
            </>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagline" className="text-gray-600">
            Короткая строка
          </Label>
          <Input
            id="tagline"
            value={tagline}
            onChange={event => setTagline(event.target.value)}
            placeholder="Одна фраза для карточки и чипа персонажа"
            className="rounded-xl border-white/70 bg-white/60"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-gray-600">
            Описание
          </Label>
          <Textarea
            id="description"
            rows={6}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Что за игра, как играть, что нужно знать"
            className="rounded-xl border-white/70 bg-white/60"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-600">Обложка</Label>
          <CoverImageUploader value={coverImage || null} onChange={url => setCoverImage(url ?? '')} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-gray-600">Окно игры</Label>
            <Select
              value={aspectRatio}
              onValueChange={value => setAspectRatio(value as GameAspectRatio)}
            >
              <SelectTrigger className="rounded-xl border-white/70 bg-white/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ASPECT_RATIO_LABEL) as GameAspectRatio[]).map(value => (
                  <SelectItem key={value} value={value}>
                    {ASPECT_RATIO_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_order" className="text-gray-600">
              Порядок в каталоге
            </Label>
            <Input
              id="display_order"
              type="number"
              min={0}
              value={displayOrder}
              onChange={event => setDisplayOrder(event.target.value)}
              className="rounded-xl border-white/70 bg-white/60"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/60 px-4 py-3">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={event => setIsPublished(event.target.checked)}
            className="h-4 w-4 accent-violet-600"
          />
          <span className="text-sm text-gray-700">
            Опубликована — игра появляется в каталоге и на страницах персонажей и релизов
          </span>
        </label>

        {!isPublished && fileStatus === 'missing' ? (
          <p className="flex items-center gap-2 text-[13px] text-amber-600">
            <TriangleAlert className="h-4 w-4" />
            Можно сохранить как черновик, но публикация без файла сломает страницу.
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-gray-600">Персонажи ({characterIds.length})</Label>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/70 bg-white/60 p-3">
              {allCharacters.length === 0 ? (
                <p className="text-sm text-gray-400">Персонажей пока нет</p>
              ) : (
                <ul className="space-y-2">
                  {allCharacters.map(character => (
                    <li key={character.id}>
                      <label className="flex items-center gap-2.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={characterIds.includes(character.id)}
                          onChange={() => toggle(characterIds, setCharacterIds, character.id)}
                          className="h-4 w-4 accent-violet-600"
                        />
                        <span className="truncate">{character.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-600">Релизы ({releaseIds.length})</Label>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/70 bg-white/60 p-3">
              {allReleases.length === 0 ? (
                <p className="text-sm text-gray-400">Релизов пока нет</p>
              ) : (
                <ul className="space-y-2">
                  {allReleases.map(release => (
                    <li key={release.id}>
                      <label className="flex items-center gap-2.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={releaseIds.includes(release.id)}
                          onChange={() => toggle(releaseIds, setReleaseIds, release.id)}
                          className="h-4 w-4 accent-violet-600"
                        />
                        <span className="truncate">
                          {release.title}
                          {release.status !== 'published' ? (
                            <span className="ml-2 text-[11px] uppercase tracking-wider text-gray-400">
                              {release.status}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/studio/games')}
            className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600"
          >
            {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать игру'}
          </Button>
        </div>
      </form>
    </div>
  )
}
