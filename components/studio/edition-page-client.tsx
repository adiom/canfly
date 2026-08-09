'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Edition, Chapter } from '@/lib/releases-types'
import { createChapterAction, deleteEditionAction, updateEditionStatusAction } from '@/lib/actions/studio'
import { ChapterList } from '@/components/studio/chapter-list'
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
import { ArrowLeft, Plus, Trash2, Settings, Globe, Archive } from 'lucide-react'

const formatLabels: Record<string, string> = {
  book: 'Книга', comic: 'Комикс', audiobook: 'Аудиокнига',
  audiorelease: 'Аудиорелиз', album: 'Альбом', magazine: 'Журнал',
}

const chapterLabels: Record<string, string> = {
  book: 'Главы', comic: 'Главы', audiobook: 'Треки',
  audiorelease: 'Треки', album: 'Треки', magazine: 'Статьи',
}

const addLabels: Record<string, string> = {
  book: 'Добавить главу', comic: 'Добавить главу', audiobook: 'Добавить трек',
  audiorelease: 'Добавить трек', album: 'Добавить трек', magazine: 'Добавить статью',
}

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

export function EditionPageClient({ edition, chapters }: { edition: Edition; chapters: Chapter[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const chapterLabel = chapterLabels[edition.format] ?? 'Главы'
  const addLabel = addLabels[edition.format] ?? 'Добавить главу'

  async function handleAddChapter() {
    setCreating(true)
    try {
      const formData = new FormData()
      formData.set('edition_id', edition.id)
      formData.set('title', `${chapterLabel === 'Треки' ? 'Трек' : chapterLabel === 'Статьи' ? 'Статья' : 'Глава'} ${chapters.length + 1}`)
      await createChapterAction(formData)
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка создания')
      setCreating(false)
    }
  }

  async function handleDeleteEdition() {
    try {
      await deleteEditionAction(edition.id, edition.release_id)
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка удаления')
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await updateEditionStatusAction(edition.id, status)
      toast.success(`Статус: ${statusLabels[status]}`)
      router.refresh()
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка смены статуса')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex items-center gap-4">
        <Link href={`/studio/releases/${edition.release_id}`}>
          <Button variant="ghost" className="rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К релизу
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{formatLabels[edition.format]}</h1>
          {edition.platform && <p className="text-gray-400">{edition.platform}</p>}
        </div>
        <Badge variant="outline" className={`border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-xl ${statusBadgeStyles[edition.status] ?? 'bg-gray-100 text-gray-500 border-gray-200/80'}`}>
          {statusLabels[edition.status] ?? edition.status}
        </Badge>
      </div>

      <Tabs defaultValue="chapters" className="space-y-6">
        <TabsList className="bg-white/60 backdrop-blur-md border border-white/70 rounded-xl shadow-sm">
          <TabsTrigger value="chapters" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            {chapterLabel} ({chapters.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            <Settings className="h-4 w-4 mr-1.5" /> Настройки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chapters" className="space-y-6">
          <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{chapterLabel}</h2>
              <Button size="sm" onClick={handleAddChapter} disabled={creating} className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
                <Plus className="mr-2 h-4 w-4" />
                {creating ? 'Создаю...' : addLabel}
              </Button>
            </div>
            {chapters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-12 text-center">
                <p className="text-gray-400">Нет {chapterLabel.toLowerCase()}. Нажмите «{addLabel}», чтобы начать.</p>
              </div>
            ) : (
              <ChapterList
                key={`${edition.id}:${chapters.map(chapter => chapter.id).join(',')}`}
                chapters={chapters}
                editionId={edition.id}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">Настройки издания</p>
              <p className="text-sm text-gray-400">Slug, платформа, обложка, персонажи, серия</p>
            </div>
            <Link href={`/studio/editions/${edition.id}/setup`}>
              <Button variant="outline" className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200">
                <Settings className="mr-2 h-4 w-4" />
                Открыть настройки
              </Button>
            </Link>
          </div>

          <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6 space-y-3">
            <h3 className="font-bold text-gray-900">Статус издания</h3>
            <div className="flex gap-2">
              {edition.status !== 'published' && (
                <Button className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:from-emerald-700 hover:to-emerald-600" onClick={() => handleStatusChange('published')}>
                  <Globe className="mr-2 h-4 w-4" />
                  Опубликовать
                </Button>
              )}
              {edition.status !== 'archived' && (
                <Button variant="outline" className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80" onClick={() => handleStatusChange('archived')}>
                  <Archive className="mr-2 h-4 w-4" />
                  В архив
                </Button>
              )}
              {edition.status !== 'draft' && (
                <Button variant="outline" className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-white/80" onClick={() => handleStatusChange('draft')}>
                  Вернуть в черновик
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="rounded-xl">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить издание
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white/80 backdrop-blur-xl border-white/70 rounded-2xl shadow-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-gray-900">Удалить издание?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Все {chapterLabel.toLowerCase()} этого издания будут удалены. Это действие необратимо.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEdition} className="rounded-xl bg-red-600 text-white">Удалить</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}