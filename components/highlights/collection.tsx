'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { jsonRequest, workshopRequest } from './api'
type Item = { id: string; text_content: string | null; unavailable: boolean; is_public: boolean }
export function HighlightCollection({ editionId }: { editionId?: string }) {
  const [saved, setSaved] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async (at: number, signal?: AbortSignal) => {
    setBusy(true)
    try {
      const rows = await workshopRequest<Item[]>(`/api/chapter-highlights/collection?saved=${saved}&offset=${at}${editionId ? '&editionId=' + editionId : ''}`, { signal })
      setItems(prev => at === 0 ? rows : [...prev, ...rows.filter(row => !prev.some(p => p.id === row.id))])
      setOffset(at + 30); setMore(rows.length === 30); setError('')
    } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message) } finally { setBusy(false) }
  }, [saved, editionId])
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(0, controller.signal) }); return () => controller.abort() }, [load])
  return <section className="space-y-4">
    <h2 className="font-serif text-2xl">Коллекция highlights</h2>
    <div className="flex gap-2"><Button variant={!saved ? 'default' : 'outline'} onClick={() => setSaved(false)}>Мои карточки</Button><Button variant={saved ? 'default' : 'outline'} onClick={() => setSaved(true)}>Сохранённые</Button></div>
    {error && <p role="alert">{error}</p>}
    {!items.length && !busy && <p className="text-cf-text-3">Здесь появятся ваши фрагменты книг.</p>}
    {items.map(item => <article key={item.id} className="space-y-3 rounded-md border border-cf-text-1/15 p-4">
      {item.unavailable ? <p>Карточка больше недоступна</p> : <Link href={`/highlight/${item.id}`} className="block font-serif text-xl">«{item.text_content}»</Link>}
      <div className="flex flex-wrap gap-3 text-sm text-cf-text-3">
        {!saved && <span>{item.is_public ? 'Опубликована' : 'Личный черновик'}</span>}
        <button type="button" disabled={busy} onClick={async () => {
          if (!saved && !window.confirm('Удалить карточку и её варианты?')) return
          setBusy(true)
          try {
            await workshopRequest(`/api/chapter-highlights/${item.id}${saved ? '/save' : ''}`, saved ? jsonRequest('PUT', { saved: false }) : { method: 'DELETE' })
            setItems(prev => prev.filter(p => p.id !== item.id))
          } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
        }}>{saved ? 'Убрать из коллекции' : 'Удалить'}</button>
      </div>
    </article>)}
    {more && <Button variant="outline" disabled={busy} onClick={() => void load(offset)}>{busy ? 'Загрузка…' : 'Показать ещё'}</Button>}
  </section>
}
