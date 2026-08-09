'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Edition, Release, ReleaseCharacter } from '@/lib/releases-types'
import { updateEditionSetupAction } from '@/lib/actions/studio'
import { CoverImageUploader } from '@/components/studio/cover-image-uploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save, BookOpen, Image, Headphones, Radio, Newspaper, Globe } from 'lucide-react'

const formatLabels: Record<string, string> = {
  book: 'Книга',
  comic: 'Комикс',
  audiobook: 'Аудиокнига',
  audiorelease: 'Аудиорелиз',
  magazine: 'Журнал',
  digital: 'Цифровой релиз',
}

const formatIcons: Record<string, React.ElementType> = {
  book: BookOpen,
  comic: Image,
  audiobook: Headphones,
  audiorelease: Radio,
  magazine: Newspaper,
  digital: Globe,
}

interface SetupData {
  edition: Edition
  release: Release | null
  characters: { id: string; name: string; slug: string; avatar: string | null }[]
  releaseCharacters: ReleaseCharacter[]
}

export function EditionSetupPage({ data }: { data: SetupData }) {
  const router = useRouter()
  const { edition, release, characters, releaseCharacters } = data
  const Icon = formatIcons[edition.format] ?? BookOpen

  const slug = edition.slug
  const [platform, setPlatform] = useState(edition.platform ?? '')
  const [externalUrl, setExternalUrl] = useState(edition.external_url ?? '')
  const [qualityTier, setQualityTier] = useState(edition.quality_tier ?? 'standard')
  const [coverImage, setCoverImage] = useState(release?.cover_image ?? '')
  const [annotation, setAnnotation] = useState(release?.annotation ?? '')
  const [selectedCharacters, setSelectedCharacters] = useState<{ character_id: string; role: string }[]>(
    releaseCharacters.map(rc => ({ character_id: rc.character_id, role: rc.role }))
  )
  const [saving, setSaving] = useState(false)

  const toggleCharacter = (characterId: string, role: string) => {
    setSelectedCharacters(prev => {
      const existing = prev.find(c => c.character_id === characterId)
      if (existing) {
        if (existing.role === role) {
          return prev.filter(c => c.character_id !== characterId)
        }
        return prev.map(c => c.character_id === characterId ? { ...c, role } : c)
      }
      return [...prev, { character_id: characterId, role }]
    })
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await updateEditionSetupAction(edition.id, {
        slug,
        platform: platform || null,
        external_url: externalUrl || null,
        quality_tier: qualityTier,
        cover_image: coverImage || null,
        annotation: annotation || null,
        character_ids: selectedCharacters,
      })
      toast.success('Настройки сохранены')
      router.push(`/studio/editions/${edition.id}`)
      router.refresh()
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [edition.id, slug, platform, externalUrl, qualityTier, coverImage, annotation, selectedCharacters, router])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex items-center gap-4">
        <Link href={`/studio/releases/${edition.release_id}`}>
          <Button variant="ghost" className="rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К релизу
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-violet-500" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{formatLabels[edition.format]}</h1>
          </div>
          <p className="text-sm text-gray-400">
            {release?.title ?? 'Релиз'} — настройка издания
          </p>
        </div>
        <Badge variant="outline" className="border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-xl bg-amber-50 text-amber-600 border-amber-200/80">
          {edition.status}
        </Badge>
      </div>

      <div className="space-y-6">
        <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-gray-600">Slug</Label>
              <Input
                value={slug}
                disabled
                className="bg-white/60 border-white/70 rounded-xl opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400">Slug создаётся автоматически и не меняется</p>
            </div>
            {edition.format === 'book' && (
              <div className="space-y-2">
                <Label className="text-gray-600">Тип издания</Label>
                <Select value={qualityTier} onValueChange={(v) => setQualityTier(v as 'draft' | 'standard' | 'premium')}>
                  <SelectTrigger className="bg-white/60 border-white/70 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="standard">Книга</SelectItem>
                    <SelectItem value="premium">Иллюстрированная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {edition.format === 'digital' && (
              <>
                <div className="space-y-2">
                  <Label className="text-gray-600">Платформа</Label>
                  <Input
                    value={platform}
                    onChange={e => setPlatform(e.target.value)}
                    placeholder="Litres, Bookmate, Amazon..."
                    className="bg-white/60 border-white/70 rounded-xl"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-gray-600">Ссылка на площадку</Label>
                  <Input
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-white/60 border-white/70 rounded-xl"
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-gray-600">Обложка</Label>
            <CoverImageUploader value={coverImage || null} onChange={(url) => setCoverImage(url ?? '')} />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-600">Аннотация</Label>
            <textarea
              value={annotation}
              onChange={e => setAnnotation(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
              placeholder="Описание произведения..."
            />
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6 space-y-4">
          <div className="space-y-3">
            <Label className="text-gray-600">Персонажи</Label>
            <p className="text-xs text-gray-400">
              Выберите персонажей и их роль в произведении
            </p>
            {characters.length > 0 ? (
              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-white/70 bg-white/30 p-3 sm:grid-cols-2">
                {characters.map(character => {
                  const selected = selectedCharacters.find(c => c.character_id === character.id)
                  return (
                    <div key={character.id} className="flex items-start gap-2 rounded-lg px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={() => toggleCharacter(character.id, selected?.role ?? 'supporting')}
                        className="mt-1 size-4 rounded accent-violet-600"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block font-medium text-gray-900">{character.name}</span>
                        <span className="block truncate text-xs text-gray-400">/{character.slug}</span>
                      </div>
                      {selected && (
                        <Select
                          value={selected.role}
                          onValueChange={role => toggleCharacter(character.id, role)}
                        >
                          <SelectTrigger className="h-7 w-auto text-xs rounded-lg bg-white/60 border-white/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">Главный</SelectItem>
                            <SelectItem value="supporting">Второстепенный</SelectItem>
                            <SelectItem value="cameo">Камео</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Персонажи пока не добавлены</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push(`/studio/releases/${edition.release_id}`)} className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80">
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Сохраняю...' : 'Сохранить и перейти к главам'}
          </Button>
        </div>
      </div>
    </div>
  )
}
