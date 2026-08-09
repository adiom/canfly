'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import type { Release, Edition, Series, ReleaseSeries } from '@/lib/releases-types'
import { updateReleaseStatusAction, deleteReleaseAction, updateReleaseSeriesAction } from '@/lib/actions/studio'
import { ReleaseForm } from '@/components/studio/release-form'
import { EditionCard } from '@/components/studio/edition-card'
import { ReleaseDesignForm } from '@/components/studio/release-design-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { ArrowLeft, ExternalLink, Globe, Archive, Trash2, Plus } from 'lucide-react'

const STATUS = {
  draft: { label: 'Черновик', stamp: 'border-cf-text-1/20 text-cf-text-3' },
  published: { label: 'Опубликован', stamp: 'border-cf-warm/40 text-cf-warm' },
  archived: { label: 'Архив', stamp: 'border-cf-text-1/15 text-cf-text-4' },
} as const

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU')
}

function Section({ title, adornment, children }: { title: string; adornment?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-cf-text-1/10 pb-2">
        <h2 className="font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent">{title}</h2>
        {adornment}
      </div>
      {children}
    </section>
  )
}

export function ReleasePageClient({ release, editions, series, releaseSeries }: { release: Release; editions: Edition[]; series: Series[]; releaseSeries: ReleaseSeries[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [seriesLink, setSeriesLink] = useState<{ series_id: string | null; phase_number: number | null }>({
    series_id: releaseSeries.length > 0 ? releaseSeries[0].series_id : null,
    phase_number: releaseSeries.length > 0 ? releaseSeries[0].phase_number : null,
  })
  const status = STATUS[release.status]

  async function handleStatusChange(status: string) {
    try {
      await updateReleaseStatusAction(release.id, status)
      toast.success(`Статус: ${STATUS[status as keyof typeof STATUS]?.label ?? status}`)
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

  const metaLine = [release.genre, release.release_date && fmtDate(release.release_date), release.isbn && `ISBN ${release.isbn}`, `${release.view_count} просмотров`]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-h-screen bg-cf-bg">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">

        {/* Назад */}
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3 transition-colors hover:text-cf-accent"
        >
          <ArrowLeft className="h-3 w-3" />
          Studio / Релизы
        </Link>

        {/* ===== Титульная плита ===== */}
        <header className="mt-10 grid gap-8 border-b-2 border-cf-text-heading pb-10 lg:grid-cols-[200px_1fr] lg:items-start">
          <div className="hidden lg:block">
            {release.cover_image ? (
              <div className="relative aspect-[3/4] w-[200px] overflow-hidden border border-cf-text-1/10 bg-cf-bg-2 shadow-sm shadow-black/10">
                <Image src={release.cover_image} alt={release.title} fill sizes="200px" className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="flex aspect-[3/4] w-[200px] flex-col items-center justify-center gap-3 border border-dashed border-cf-text-1/15 bg-cf-bg-2">
                <span className="font-[family-name:var(--font-cormorant)] text-6xl font-bold italic leading-none text-cf-text-3">
                  {release.title.slice(0, 1).toUpperCase()}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">Без обложки</span>
              </div>
            )}
          </div>

          <div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-cf-text-3">
              <span>Релиз в студии</span>
              <span className="text-cf-accent">·</span>
              <span className={`border px-2 py-0.5 ${status.stamp}`}>{status.label}</span>
            </p>

            <h1
              className="mt-4 break-words font-[family-name:var(--font-cormorant)] text-4xl font-bold italic leading-[0.92] text-cf-text-heading sm:text-5xl md:text-6xl"
            >
              {release.title}
            </h1>

            <p className="mt-6 max-w-2xl font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-cf-text-3">
              {metaLine || 'Без жанра, даты и публикаций'}
            </p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-4">
              /{release.slug} · {release.id}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {release.status === 'published' && (
                <a
                  href={`/release/${release.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 bg-cf-accent px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Открыть на сайте
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Сводка */}
        <div className="my-10 grid grid-cols-3 divide-x divide-cf-text-1/10 border border-cf-text-1/10">
          {[
            { value: editions.length, label: 'Изданий' },
            { value: release.view_count.toLocaleString('ru-RU'), label: 'Просмотров' },
            { value: new Date(release.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }), label: 'Обновлён' },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center justify-center px-2 py-6 text-center">
              <span className="max-w-full truncate font-[family-name:var(--font-cormorant)] text-3xl font-bold leading-none text-cf-text-heading md:text-4xl">
                {value}
              </span>
              <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">{label}</span>
            </div>
          ))}
        </div>

        {/* Рабочая область */}
        <div className="grid gap-14 lg:grid-cols-3 lg:gap-12">
          {/* Левая колонка — рукопись */}
          <div className="space-y-14 lg:col-span-2">
            <Section title="Основные данные">
              <ReleaseForm release={release} />
            </Section>

            <Section
              title="Издания"
              adornment={
                <span className="flex items-center gap-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-3">{editions.length} изд.</span>
                  <Link
                    href={`/studio/editions/new?releaseId=${release.id}`}
                    className="inline-flex h-9 items-center gap-1.5 border border-cf-text-1/12 bg-cf-bg-2 px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-cf-text-2 transition-colors hover:border-cf-warm/45 hover:text-cf-text-heading"
                  >
                    <Plus className="h-3 w-3" />
                    Новое издание
                  </Link>
                </span>
              }
            >
              {editions.length === 0 ? (
                <div className="border border-dashed border-cf-text-1/15 py-16 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cf-text-3">
                    Изданий пока нет — создайте первое
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
                  {editions.map(edition => (
                    <EditionCard key={edition.id} edition={edition} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Правая колонка — оргпанель */}
          <aside className="space-y-14 lg:space-y-12">
            <Section title="Публикация">
              <div className="flex flex-col gap-2">
                {release.status !== 'published' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('published')}
                    className="inline-flex h-11 items-center justify-center gap-2 bg-cf-accent px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e]"
                  >
                    <Globe className="h-4 w-4" />
                    Опубликовать
                  </button>
                )}
                {release.status !== 'archived' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('archived')}
                    className="inline-flex h-11 items-center justify-center gap-2 border border-cf-text-1/12 bg-cf-bg-2 px-4 text-xs font-black uppercase tracking-[0.08em] text-cf-text-2 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-heading"
                  >
                    <Archive className="h-4 w-4" />
                    В архив
                  </button>
                )}
                {release.status !== 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('draft')}
                    className="inline-flex h-11 items-center justify-center gap-2 border border-cf-text-1/12 bg-cf-bg-2 px-4 text-xs font-black uppercase tracking-[0.08em] text-cf-text-2 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-heading"
                  >
                    Вернуть в черновик
                  </button>
                )}
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-cf-text-4">
                Публикация открывает релиз и его издания на сайте canfly.
              </p>
            </Section>

            <Section title="Серия">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-cf-text-3">
                    Серия
                  </Label>
                  <Select
                    value={seriesLink.series_id ?? ''}
                    onValueChange={v => setSeriesLink(prev => ({ ...prev, series_id: v || null }))}
                  >
                    <SelectTrigger className="h-10 rounded-none border-cf-text-1/15 bg-cf-bg-2 text-sm text-cf-text-1">
                      <SelectValue placeholder="Без серии" />
                    </SelectTrigger>
                    <SelectContent className="bg-cf-bg-2 border-cf-text-1/10">
                      {series.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {series.length === 0 && (
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cf-text-4">
                      Серии создаются в <Link href="/studio/series" className="text-cf-accent underline decoration-cf-accent/40 underline-offset-2">Studio → Серии</Link>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phase_number" className="inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-cf-text-3">
                    Фаза в серии
                  </Label>
                  <Input
                    id="phase_number"
                    type="number"
                    min="0"
                    placeholder="1, 2, 3…"
                    value={seriesLink.phase_number ?? ''}
                    onChange={e => setSeriesLink(prev => ({ ...prev, phase_number: e.target.value ? Number(e.target.value) : null }))}
                    className="rounded-none border-cf-text-1/15 bg-cf-bg-2 text-cf-text-1"
                  />
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cf-text-4">Необязательно. Порядок в серии.</p>
                </div>

                <button
                  type="button"
                  onClick={handleSeriesSave}
                  className="inline-flex h-10 items-center justify-center gap-2 border border-cf-text-1/12 bg-cf-bg-2 px-4 text-xs font-black uppercase tracking-[0.08em] text-cf-text-2 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-heading"
                >
                  Сохранить серию
                </button>
              </div>
            </Section>

            <Section title="Опасная зона">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={deleting}
                    className="inline-flex h-10 items-center justify-center gap-2 border border-cf-accent/30 px-4 text-xs font-black uppercase tracking-[0.08em] text-cf-accent transition-colors hover:bg-cf-accent/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить релиз
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-cf-text-1/10 bg-cf-bg shadow-2xl shadow-black/20">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-[family-name:var(--font-cormorant)] text-3xl font-bold italic text-cf-text-heading">
                      Удалить «{release.title}»?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-cf-text-2">
                      Это действие необратимо. Все издания, главы и данные будут удалены.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border border-cf-text-1/12 bg-cf-bg-2 text-cf-text-2 hover:bg-cf-text-1/6 hover:text-cf-text-heading">
                      Отмена
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-cf-accent text-white hover:bg-[#b81e1e]"
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Section>
          </aside>
        </div>

        {/* Оформление — полная ширина */}
        <div className="mt-16 border-t-2 border-cf-text-heading pt-12 lg:mt-20">
          <Section title="Оформление страницы релиза">
            <ReleaseDesignForm release={release} />
          </Section>
        </div>
      </div>
    </div>
  )
}