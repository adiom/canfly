'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { ChevronDown, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Release, ReleaseSeries, ReleaseStatus, Series } from '@/lib/releases-types'
import { deleteReleaseAction, updateReleaseSeriesAction, updateReleaseStatusAction } from '@/lib/actions/studio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const STATUS_LABELS: Record<ReleaseStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  archived: 'Архив',
}

export function ReleasePublicationMenu({ release, series, releaseSeries, disabled, onPendingChange }: {
  release: Release
  series: Series[]
  releaseSeries: ReleaseSeries[]
  disabled: boolean
  onPendingChange: (pending: boolean) => void
}) {
  const statusTrigger = useRef<HTMLButtonElement>(null)
  const [publicationOpen, setPublicationOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<ReleaseStatus | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [seriesLink, setSeriesLink] = useState(() => ({
    series_id: releaseSeries[0]?.series_id ?? '',
    phase_number: releaseSeries[0]?.phase_number?.toString() ?? '',
  }))
  const [seriesBaseline, setSeriesBaseline] = useState(seriesLink)
  const [seriesSaving, setSeriesSaving] = useState(false)
  const [seriesSaved, setSeriesSaved] = useState(false)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const status = selectedStatus ?? release.status
  const seriesDirty = JSON.stringify(seriesLink) !== JSON.stringify(seriesBaseline)

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || statusSaving || status === release.status) return
    setStatusSaving(true)
    setStatusError(null)
    onPendingChange(true)
    try {
      await updateReleaseStatusAction(release.id, status)
      setSelectedStatus(null)
      toast.success(`Статус: ${STATUS_LABELS[status]}`)
    } catch (error) {
      unstable_rethrow(error)
      setStatusError('Не удалось изменить статус. Попробуйте ещё раз.')
    } finally {
      setStatusSaving(false)
      onPendingChange(false)
    }
  }

  async function saveSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (seriesSaving) return
    const submitted = { ...seriesLink }
    setSeriesSaving(true)
    setSeriesError(null)
    try {
      await updateReleaseSeriesAction(release.id, submitted.series_id ? [{
        series_id: submitted.series_id,
        phase_number: submitted.phase_number === '' ? null : Number(submitted.phase_number),
      }] : [])
      setSeriesBaseline(submitted)
      setSeriesSaved(true)
      toast.success('Серия сохранена')
    } catch (error) {
      unstable_rethrow(error)
      setSeriesError('Не удалось сохранить серию. Попробуйте ещё раз.')
    } finally {
      setSeriesSaving(false)
    }
  }

  async function removeRelease() {
    if (deleting || confirmation !== release.title) return
    setDeleting(true)
    setDeleteError(null)
    onPendingChange(true)
    try {
      await deleteReleaseAction(release.id)
    } catch (error) {
      unstable_rethrow(error)
      setDeleteError('Не удалось удалить релиз. Попробуйте ещё раз.')
    } finally {
      setDeleting(false)
      onPendingChange(false)
    }
  }

  return (
    <AlertDialog open={deleteOpen} onOpenChange={open => {
      if (deleting) return
      setDeleteOpen(open)
      if (!open) { setConfirmation(''); setDeleteError(null) }
    }}>
      <Popover open={publicationOpen} onOpenChange={setPublicationOpen}>
        <PopoverTrigger asChild>
          <Button ref={statusTrigger} variant="outline" className="paper-button paper-status-button" aria-label={`Публикация: ${STATUS_LABELS[release.status]}`}>
            <span className="paper-status-dot" data-status={release.status} aria-hidden="true" />
            {STATUS_LABELS[release.status]}<ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} className="paper-theme paper-publication" aria-label="Публикация релиза" onCloseAutoFocus={event => { if (deleteOpen) event.preventDefault() }}>
          <h2 className="paper-menu-title">Публикация</h2>
          <form onSubmit={saveStatus} className="paper-publication-status" aria-busy={statusSaving}>
            <div className="paper-field">
              <Label htmlFor="release-status">Статус</Label>
              <Select value={status} disabled={disabled || statusSaving} onValueChange={value => { setSelectedStatus(value as ReleaseStatus); setStatusError(null) }}>
                <SelectTrigger id="release-status"><SelectValue /></SelectTrigger>
                <SelectContent className="paper-theme paper-select">
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline" className="paper-button w-full" disabled={disabled || statusSaving || status === release.status}>
              {statusSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {statusSaving ? 'Применяю…' : 'Применить статус'}
            </Button>
            <p className="paper-help mt-2" role="status">{status !== release.status ? 'Статус ещё не применён' : 'Статус сохранён'}</p>
            {statusError && <p role="alert" className="paper-error">{statusError}</p>}
          </form>
          <details className="paper-details">
            <summary>Серия<ChevronDown className="size-4" aria-hidden="true" /></summary>
            <form onSubmit={saveSeries} className="paper-details-body" aria-label="Серия релиза" aria-busy={seriesSaving}>
              <div className="paper-field">
                <Label htmlFor="release-series">Серия</Label>
                <Select value={seriesLink.series_id || 'none'} disabled={seriesSaving} onValueChange={value => {
                  setSeriesLink(previous => ({ ...previous, series_id: value === 'none' ? '' : value, ...(value === 'none' ? { phase_number: '' } : {}) }))
                  setSeriesError(null)
                }}>
                  <SelectTrigger id="release-series"><SelectValue /></SelectTrigger>
                  <SelectContent className="paper-theme paper-select">
                    <SelectItem value="none">Без серии</SelectItem>
                    {series.map(item => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="paper-field">
                <Label htmlFor="release-phase">Номер фазы</Label>
                <Input id="release-phase" type="number" min={0} step={1} value={seriesLink.phase_number} disabled={seriesSaving || !seriesLink.series_id} onChange={event => { setSeriesLink(previous => ({ ...previous, phase_number: event.target.value })); setSeriesError(null) }} placeholder="Не задан" />
              </div>
              <Button type="submit" variant="outline" className="paper-button w-full" disabled={seriesSaving || !seriesDirty}>
                {seriesSaving ? 'Сохраняю…' : 'Сохранить серию'}
              </Button>
              <p role="status" className="paper-help mt-2">{seriesSaving ? 'Сохраняю серию…' : seriesDirty ? 'Есть несохранённые изменения' : seriesSaved ? 'Серия сохранена' : 'Нет изменений'}</p>
              {seriesError && <p role="alert" className="paper-error">{seriesError}</p>}
              {series.length === 0 && <p className="paper-help mt-2">Добавить серию можно в разделе <Link href="/studio/series" className="underline">«Серии»</Link>.</p>}
            </form>
          </details>
          <div className="paper-delete-section">
            <Button type="button" variant="ghost" className="paper-button paper-danger w-full" disabled={disabled || statusSaving || seriesSaving} onClick={() => { setPublicationOpen(false); setDeleteOpen(true) }}>
              <Trash2 className="size-4" aria-hidden="true" />Удалить релиз
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialogContent className="paper-theme paper-delete-dialog" onCloseAutoFocus={event => { event.preventDefault(); statusTrigger.current?.focus() }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить релиз?</AlertDialogTitle>
          <AlertDialogDescription>Релиз «{release.title}», его издания и главы будут удалены. Это действие нельзя отменить.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="paper-field">
          <Label htmlFor="release-delete-confirmation">Введите название релиза для подтверждения</Label>
          <Input id="release-delete-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={deleting} autoComplete="off" />
        </div>
        {deleteError && <p role="alert" className="paper-error">{deleteError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="paper-button" disabled={deleting}>Отмена</AlertDialogCancel>
          <AlertDialogAction className="paper-button paper-button-primary" disabled={deleting || confirmation !== release.title} onClick={event => { event.preventDefault(); void removeRelease() }}>
            {deleting ? 'Удаляю…' : 'Удалить навсегда'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
