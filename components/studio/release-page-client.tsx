'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import type { Release, Edition, Series, ReleaseSeries } from '@/lib/releases-types'
import { updateReleaseStatusAction, deleteReleaseAction } from '@/lib/actions/studio'
import { ReleaseForm } from '@/components/studio/release-form'
import { EditionCard } from '@/components/studio/edition-card'
import { ReleaseDesignForm } from '@/components/studio/release-design-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Globe, Archive, Trash2, Plus, Palette, Settings, FileText, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateReleaseSeriesAction } from '@/lib/actions/studio'

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  archived: 'Архив',
}

const statusBadgeStyles: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-600 border-amber-200/80',
  published: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
  archived: 'bg-gray-100 text-gray-500 border-gray-200/80',
}

export function ReleasePageClient({ release, editions, series, releaseSeries }: { release: Release; editions: Edition[]; series: Series[]; releaseSeries: ReleaseSeries[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [seriesLink, setSeriesLink] = useState<{ series_id: string | null; phase_number: number | null }>({
    series_id: releaseSeries.length > 0 ? releaseSeries[0].series_id : null,
    phase_number: releaseSeries.length > 0 ? releaseSeries[0].phase_number : null,
  })

  async function handleStatusChange(status: string) {
    try {
      await updateReleaseStatusAction(release.id, status)
      toast.success(`Статус: ${statusLabels[status]}`)
      router.refresh()
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка смены статуса')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteReleaseAction(release.id)
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка удаления')
      setDeleting(false)
    }
  }

  async function handleSeriesSave() {
    try {
      const payload: { series_id: string; phase_number: number | null }[] =
        seriesLink.series_id
          ? [{ series_id: seriesLink.series_id, phase_number: seriesLink.phase_number }]
          : []
      await updateReleaseSeriesAction(release.id, payload)
      toast.success('Серия сохранена')
      router.refresh()
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка сохранения серии')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/studio">
          <Button variant="ghost" className="rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Релизы
          </Button>
        </Link>
        <h1 className="flex-1 text-2xl font-bold text-gray-900 tracking-tight">{release.title}</h1>
        <Badge variant="outline" className={`border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-xl ${statusBadgeStyles[release.status]}`}>
          {statusLabels[release.status]}
        </Badge>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-white/60 backdrop-blur-md border border-white/70 rounded-xl shadow-sm">
          <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            <FileText className="h-4 w-4 mr-1.5" /> Общее
          </TabsTrigger>
          <TabsTrigger value="editions" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            Издания ({editions.length})
          </TabsTrigger>
          <TabsTrigger value="design" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            <Palette className="h-4 w-4 mr-1.5" /> Дизайн
          </TabsTrigger>
          <TabsTrigger value="series" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            <BookOpen className="h-4 w-4 mr-1.5" /> Серия
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            <Settings className="h-4 w-4 mr-1.5" /> Настройки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <ReleaseForm release={release} />
        </TabsContent>

        <TabsContent value="editions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Издания</h2>
            <Link href={`/studio/editions/new?releaseId=${release.id}`}>
              <Button size="sm" className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
                <Plus className="mr-2 h-4 w-4" />
                Новое издание
              </Button>
            </Link>
          </div>
          {editions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-16 text-center">
              <p className="text-gray-400">Нет изданий. Создайте первое издание для этого релиза.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {editions.map(edition => (
                <EditionCard key={edition.id} edition={edition} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="series" className="space-y-6">
          <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Серия</h2>
            <p className="text-sm text-gray-500">
              Привяжите релиз к серии, чтобы он отображался на странице серии (/series/[slug]).
            </p>

            <div className="space-y-3">
              <Label>Серия</Label>
              <Select
                value={seriesLink.series_id ?? ''}
                onValueChange={v => setSeriesLink(prev => ({ ...prev, series_id: v || null }))}
              >
                <SelectTrigger className="bg-white/60 border-white/70 rounded-xl">
                  <SelectValue placeholder="Выберите серию (необязательно)" />
                </SelectTrigger>
                <SelectContent>
                  {series.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {series.length === 0 && (
                <p className="text-xs text-gray-400">
                  Серии создаются в <Link href="/studio/series" className="text-violet-600">Studio → Серии</Link>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phase_number">Фаза (номер в серии)</Label>
              <Input
                id="phase_number"
                type="number"
                min="0"
                placeholder="1, 2, 3..."
                value={seriesLink.phase_number ?? ''}
                onChange={e => setSeriesLink(prev => ({ ...prev, phase_number: e.target.value ? Number(e.target.value) : null }))}
                className="bg-white/60 border-white/70 rounded-xl"
              />
              <p className="text-xs text-gray-400">Необязательно. Используется для сортировки в серии.</p>
            </div>

            <div className="pt-2">
              <Button onClick={handleSeriesSave} className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
                Сохранить серию
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="design">
          <ReleaseDesignForm release={release} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Статус публикации</h3>
            <div className="flex gap-2">
              {release.status !== 'published' && (
                <Button className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:from-emerald-700 hover:to-emerald-600" onClick={() => handleStatusChange('published')}>
                  <Globe className="mr-2 h-4 w-4" />
                  Опубликовать
                </Button>
              )}
              {release.status !== 'archived' && (
                <Button variant="outline" className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80" onClick={() => handleStatusChange('archived')}>
                  <Archive className="mr-2 h-4 w-4" />
                  В архив
                </Button>
              )}
              {release.status !== 'draft' && (
                <Button variant="outline" className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80" onClick={() => handleStatusChange('draft')}>
                  Вернуть в черновик
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-6 space-y-4">
            <h3 className="font-bold text-red-600">Опасная зона</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting} className="rounded-xl">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить релиз
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white/80 backdrop-blur-xl border-white/70 rounded-2xl shadow-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-gray-900">Удалить &laquo;{release.title}&raquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Это действие необратимо. Все издания, главы и данные будут удалены.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl border-white/70 bg-white/60 text-gray-600">Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-600 text-white">Удалить</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}