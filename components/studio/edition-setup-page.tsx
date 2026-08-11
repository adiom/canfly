'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Edition, Release } from '@/lib/releases-types'
import { updateEditionSetupAction } from '@/lib/actions/studio'
import { generateSlug } from '@/lib/slug-utils'
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
}

export function EditionSetupPage({ data }: { data: SetupData }) {
  const router = useRouter()
  const { edition, release } = data
  const Icon = formatIcons[edition.format] ?? BookOpen

  const [slug, setSlug] = useState(edition.slug)
  const [platform, setPlatform] = useState(edition.platform ?? '')
  const [externalUrl, setExternalUrl] = useState(edition.external_url ?? '')
  const [qualityTier, setQualityTier] = useState(edition.quality_tier ?? 'standard')
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await updateEditionSetupAction(edition.id, {
        slug,
        platform: platform || null,
        external_url: externalUrl || null,
        quality_tier: qualityTier,
      })
      toast.success('Настройки сохранены')
      router.push(`/studio/editions/${edition.id}`)
      router.refresh()
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [edition.id, slug, platform, externalUrl, qualityTier, router])

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
                onChange={e => setSlug(e.target.value)}
                onBlur={() => {
                  if (!slug.trim()) setSlug(generateSlug(formatLabels[edition.format]))
                }}
                className="bg-white/60 border-white/70 rounded-xl"
              />
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
