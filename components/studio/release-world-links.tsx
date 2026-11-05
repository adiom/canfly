'use client'

import { useState } from 'react'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changeReleaseWorldLinkAction } from '@/lib/actions/studio'

export type WorldOption = { id: string; name: string; slug: string; available: boolean }

export function ReleaseWorldLinks({ releaseId, kind, options, linkedIds, canEdit }: {
  releaseId: string
  kind: 'game' | 'place'
  options: WorldOption[]
  linkedIds: string[]
  canEdit: boolean
}) {
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const title = kind === 'game' ? 'Игры' : 'Места'
  const basePath = kind === 'game' ? '/games' : '/places'
  const matches = search.trim().toLocaleLowerCase('ru')
  const linked = options.filter(item => linkedIds.includes(item.id))
  const suggestions = matches ? options.filter(item => !linkedIds.includes(item.id) && item.name.toLocaleLowerCase('ru').includes(matches)).slice(0, 12) : []

  async function change(id: string, linked: boolean) {
    if (pending) return
    setPending(true)
    setError(false)
    try {
      await changeReleaseWorldLinkAction(releaseId, { kind, id, linked })
    } catch (cause) {
      unstable_rethrow(cause)
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="mt-7 border-t border-cf-text-1/10 pt-5" aria-labelledby={`release-links-${kind}`} aria-busy={pending}>
      <h3 id={`release-links-${kind}`} className="mb-3 font-semibold">{title}</h3>
      {linked.length === 0 && <p className="paper-help">Связей пока нет.</p>}
      <ul className="grid gap-2">
        {linked.map(item => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
            {item.available ? <Link className="underline underline-offset-4" href={`${basePath}/${item.slug}`}>{item.name}</Link> : <span>{item.name} · черновик</span>}
            {canEdit && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void change(item.id, false)} aria-label={`Убрать связь: ${item.name}`}>Убрать связь</Button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="paper-field mt-4">
          <Label htmlFor={`release-search-${kind}`}>Поиск {kind === 'game' ? 'игр' : 'мест'}</Label>
          <Input id={`release-search-${kind}`} value={search} onChange={event => setSearch(event.target.value)} />
          {matches && suggestions.length === 0 && <p className="paper-help">Подходящих объектов нет.</p>}
          <ul className="grid gap-2">
            {suggestions.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{item.name}{!item.available && ' · черновик'}</span>
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void change(item.id, true)} aria-label={`Связать: ${item.name}`}>Связать</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="paper-error" role="alert">Не удалось изменить связь. Попробуйте ещё раз.</p>}
    </section>
  )
}
