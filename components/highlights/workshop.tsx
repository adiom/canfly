'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { HighlightMaterial, HighlightWorkshop, HighlightPublication } from '@/lib/highlights/types'
import { HighlightComposition } from './composition'
import { workshopRequest, jsonRequest } from './api'

type Tab = 'source' | 'text' | 'images' | 'publish'
const tabs: [Tab, string][] = [['source', 'Источник'], ['text', 'Мой текст'], ['images', 'Изображения'], ['publish', 'Публикация']]
const field = 'w-full rounded-md border border-cf-text-1/20 bg-cf-bg p-3 text-cf-text-1'
const labels = { explain: 'Объясни', meaning: 'Смысл', rewrite: 'Перепиши' } as const

export function HighlightWorkshopView({ id, initial, onClose }: { id: string; initial?: HighlightWorkshop; onClose?: () => void }) {
  const [data, setData] = useState<HighlightWorkshop | null>(initial ?? null)
  const [tab, setTab] = useState<Tab>('source')
  const [note, setNote] = useState(initial?.note ?? '')
  const [text, setText] = useState(initial?.draft_text ?? '')
  const [status, setStatus] = useState('Сохранено')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [mode, setMode] = useState('другой-стиль')
  const [caption, setCaption] = useState('')
  const [selected, setSelected] = useState<string[]>(initial?.publication?.materials.map(m => m.id) ?? [])
  const [includeNote, setIncludeNote] = useState(!!initial?.publication?.note)
  const [preview, setPreview] = useState(false)
  const [materialsOffset, setMaterialsOffset] = useState(30)
  const [moreMaterials, setMoreMaterials] = useState((initial?.materials.length ?? 30) >= 30)
  const version = useRef(initial?.version ?? 1)
  const draft = useRef({ note: initial?.note ?? '', text: initial?.draft_text ?? '', parentId: null as string | null })
  const saved = useRef(JSON.stringify({ note: initial?.note ?? '', text: initial?.draft_text ?? '', parentId: null }))
  const pending = useRef<Promise<void> | null>(null)
  const blocked = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const [dirty, setDirty] = useState(false)

  const refresh = useCallback(async () => {
    const next = await workshopRequest<HighlightWorkshop>(`/api/chapter-highlights/${id}/workshop`)
    setData(next)
    version.current = next.version
    return next
  }, [id])

  useEffect(() => {
    if (initial) return
    let cancelled = false
    workshopRequest<HighlightWorkshop>(`/api/chapter-highlights/${id}/workshop`).then(next => {
      if (cancelled) return
      setData(next); version.current = next.version
      draft.current = { note: next.note ?? '', text: next.draft_text, parentId: null }
      saved.current = JSON.stringify(draft.current)
      setNote(next.note ?? ''); setText(next.draft_text)
      setSelected(next.publication?.materials.map(m => m.id) ?? [])
      setIncludeNote(!!next.publication?.note)
      setMoreMaterials(next.materials.length === 30)
    }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [id, initial])
  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const flush = useCallback(async () => {
    if (blocked.current) throw new Error('Сначала перечитайте серверную версию')
    if (pending.current) await pending.current
    const value = { ...draft.current }
    if (JSON.stringify(value) === saved.current) return
    setStatus('Сохраняется…')
    const work = (async () => {
      try {
        const result = await workshopRequest<{ version: number }>(`/api/chapter-highlights/${id}/workshop`,
          jsonRequest('PATCH', { version: version.current, ...value, note: value.note || null, requestId: crypto.randomUUID() }))
        version.current = result.version
        saved.current = JSON.stringify(value)
        const stillDirty = saved.current !== JSON.stringify(draft.current)
        setDirty(stillDirty); setStatus(stillDirty ? 'Есть несохранённые изменения' : 'Сохранено')
        const materials = await workshopRequest<HighlightMaterial[]>(`/api/chapter-highlights/${id}/materials`)
        setData(prev => prev ? { ...prev, version: result.version, materials: [...materials, ...prev.materials.filter(m => !materials.some(n => n.id === m.id))] } : prev)
      } catch (e) {
        const problem = e as Error & { status?: number }
        setStatus('Не сохранено'); setError(problem.message)
        if (problem.status === 409) { blocked.current = true; setConflict(true) }
        throw e
      }
    })()
    pending.current = work
    try { await work } finally { if (pending.current === work) pending.current = null }
  }, [id])

  useEffect(() => {
    if (!dirty || conflict || error) return
    const timer = setTimeout(() => { void flush().catch(() => undefined) }, 900)
    return () => clearTimeout(timer)
  }, [note, text, dirty, conflict, error, flush])

  const change = (which: 'note' | 'text', value: string) => {
    draft.current[which] = value
    if (which === 'note') setNote(value); else setText(value)
    setDirty(true); setStatus('Есть несохранённые изменения')
  }
  const report = (e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось выполнить действие')
  const close = async () => {
    abort.current?.abort()
    try { await flush(); onClose?.() } catch (e) { report(e) }
  }
  const generate = async (kind: 'explain' | 'meaning' | 'rewrite' | 'illustrate') => {
    setError(''); setBusy(true)
    const controller = new AbortController(); abort.current = controller
    try {
      await flush()
      const material = await workshopRequest<HighlightMaterial>(`/api/highlights/${kind}`, {
        ...jsonRequest('POST', { highlightId: id, requestId: crypto.randomUUID(), instruction, mode }), signal: controller.signal,
      })
      setData(prev => prev ? { ...prev, materials: [material, ...prev.materials.filter(m => m.id !== material.id)] } : prev)
    } catch (e) {
      const issue = e as Error & { unsavedText?: string }
      if (issue.unsavedText) { change('text', issue.unsavedText); setTab('text') }
      if (issue.name !== 'AbortError') report(issue)
    } finally { setBusy(false) }
  }
  const editVariant = async (material: HighlightMaterial) => {
    try {
      await flush()
      draft.current.parentId = material.id
      change('text', material.content)
      setTab('text')
    } catch (e) { report(e) }
  }
  const publish = async (published: boolean) => {
    setBusy(true); setError('')
    try {
      await flush()
      await workshopRequest(`/api/chapter-highlights/${id}/publication`, jsonRequest('PUT', {
        version: version.current, published, includeNote, materialIds: selected,
      }))
      await refresh(); setPreview(false); setStatus(published ? 'Публикация обновлена' : 'Публикация закрыта')
    } catch (e) { report(e) } finally { setBusy(false) }
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const body = new FormData(); body.set('file', file); body.set('caption', caption); body.set('requestId', crypto.randomUUID())
      const material = await workshopRequest<HighlightMaterial>(`/api/chapter-highlights/${id}/images`, { method: 'POST', body })
      setData(prev => prev ? { ...prev, materials: [material, ...prev.materials] } : prev)
    } catch (e) { report(e) } finally { setBusy(false) }
  }
  const more = async () => {
    try {
      const rows = await workshopRequest<HighlightMaterial[]>(`/api/chapter-highlights/${id}/materials?offset=${materialsOffset}`)
      setData(prev => prev ? { ...prev, materials: [...prev.materials, ...rows.filter(m => !prev.materials.some(p => p.id === m.id))] } : prev)
      setMaterialsOffset(value => value + 30); setMoreMaterials(rows.length === 30)
    } catch (e) { report(e) }
  }
  const visibleMaterials = [...(data?.materials ?? []), ...(data?.publication?.materials.filter(m => !data.materials.some(p => p.id === m.id)) ?? [])]
  const composition: HighlightPublication = { note: includeNote ? note : null, materials: selected.map(mid => visibleMaterials.find(m => m.id === mid)).filter((m): m is HighlightMaterial => !!m), published_at: '' }

  const body = <div className="space-y-6 text-cf-text-1">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs uppercase tracking-[0.2em] text-cf-accent">Личная мастерская</p><h1 className="font-serif text-3xl">Твой фрагмент книги</h1></div>
      <span role="status" className="text-sm text-cf-text-3">{busy ? 'Работаем…' : status}</span>
    </header>
    {error && <div role="alert" className="space-y-2 rounded-md border border-cf-accent/40 p-3">
      <p>{error}</p>
      {conflict ? <Button variant="outline" onClick={async () => {
        try { await refresh(); blocked.current = false; setConflict(false); setError('Серверная версия перечитана. Ваш локальный текст оставлен в редакторе. Нажмите «Сохранить», чтобы записать его.'); setDirty(true) } catch (e) { report(e) }
      }}>Перечитать серверную версию</Button> : <Button variant="outline" onClick={() => { setError(''); void flush().catch(report) }}>Повторить сохранение</Button>}
    </div>}
    {!data ? <p>Загрузка карточки…</p> : !data.permissions.edit ? <HighlightComposition quote={data.text_content} publication={data.publication} /> : <>
      <nav className="flex gap-1 overflow-x-auto border-b border-cf-text-1/15" aria-label="Разделы мастерской">
        {tabs.map(([key, title]) => <Button key={key} variant={tab === key ? 'default' : 'ghost'} onClick={async () => { try { await flush(); setTab(key); setPreview(false) } catch (e) { report(e) } }}>{title}</Button>)}
      </nav>
      {tab === 'source' && <section className="space-y-5">
        <HighlightComposition quote={data.text_content} publication={null} />
        <p>{data.release_title} · {data.chapter_title}</p>
        {data.anchor_status === 'missing' && <p role="status" className="text-cf-accent">Исходный фрагмент изменён. Точное место не найдено; цитата сохранена.</p>}
        {data.source_available && <Link className="underline" href={`/vvvvv/${data.edition_slug}?highlight=${id}`}>Открыть в книге</Link>}
        <label className="block space-y-2"><span>Личная заметка</span><textarea className={field} rows={4} maxLength={2000} value={note} onChange={e => change('note', e.target.value)} /></label>
        <p className="text-sm text-cf-text-3">Заметка и новые варианты остаются личными, пока вы не включите их в публикацию.</p>
      </section>}
      {tab === 'text' && <section className="space-y-4">
        <label className="block space-y-2"><span>Ваш текст по мотивам фрагмента</span><textarea className={field} rows={10} maxLength={20000} value={text} onChange={e => change('text', e.target.value)} /></label>
        <Button variant="outline" disabled={busy || conflict} onClick={() => void flush().catch(report)}>Сохранить</Button>
        <label className="block space-y-2"><span>Направление для AI</span><textarea className={field} maxLength={1000} rows={2} value={instruction} placeholder="Например: расскажи сцену от лица другого героя" onChange={e => setInstruction(e.target.value)} /></label>
        <label className="block space-y-2"><span>Способ переосмысления</span><select className={field} value={mode} onChange={e => setMode(e.target.value)}><option value="другой-стиль">Другой стиль</option><option value="другой-финал">Другой финал</option><option value="другая-эпоха">Другая эпоха</option></select></label>
        <div className="flex flex-wrap gap-2">{Object.entries(labels).map(([kind, label]) => <Button key={kind} disabled={busy || conflict} onClick={() => void generate(kind as keyof typeof labels)}>{label}</Button>)}</div>
        <h2 className="pt-4 font-serif text-2xl">Сохранённые варианты</h2>
        {data.materials.filter(m => m.kind !== 'image').map(m => <article key={m.id} className="space-y-3 rounded-md border border-cf-text-1/15 p-4">
          <p className="text-xs text-cf-text-3">{m.origin === 'ai' ? 'AI' : 'Ваш текст'} · {new Date(m.created_at).toLocaleString('ru-RU')}</p>
          <p className="whitespace-pre-wrap">{m.content}</p><Button variant="outline" disabled={busy} onClick={() => void editVariant(m)}>Продолжить этот вариант</Button>
        </article>)}
      </section>}
      {tab === 'images' && <section className="space-y-5">
        <label className="block space-y-2"><span>Что нарисовать</span><textarea className={field} maxLength={1000} rows={3} value={instruction} onChange={e => setInstruction(e.target.value)} /></label>
        <Button disabled={busy} onClick={() => void generate('illustrate')}>Создать иллюстрацию</Button>
        <label className="block space-y-2"><span>Подпись к своей картинке</span><input className={field} maxLength={2000} value={caption} onChange={e => setCaption(e.target.value)} /></label>
        <label className="block space-y-2"><span>Загрузить изображение · до 10 МБ</span><input className={field} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} /></label>
        <div className="grid gap-4 sm:grid-cols-2">{data.materials.filter(m => m.kind === 'image' && m.image_url).map(m => <figure key={m.id}><Image src={m.image_url!} alt={m.content || 'Вариант иллюстрации'} width={512} height={512} unoptimized className="h-auto w-full rounded-md" /><figcaption className="mt-2 text-sm">{m.content}</figcaption></figure>)}</div>
      </section>}
      {(tab === 'text' || tab === 'images') && moreMaterials && <Button variant="outline" onClick={() => void more()}>Загрузить ещё варианты</Button>}
      {tab === 'publish' && <section className="space-y-5">
        {!data.permissions.publish && <p role="alert">Источник не опубликован. Публикация пока недоступна.</p>}
        {!preview ? <>
          <h2 className="font-serif text-2xl">Что увидят другие</h2>
          <label className="flex items-center gap-2"><input type="checkbox" checked={includeNote} onChange={e => setIncludeNote(e.target.checked)} />Включить заметку</label>
          {visibleMaterials.map(m => <label key={m.id} className="flex items-start gap-3 rounded-md border border-cf-text-1/15 p-3">
            <input type="checkbox" checked={selected.includes(m.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev.filter(mid => m.kind !== 'image' || visibleMaterials.find(v => v.id === mid)?.kind !== 'image'), m.id] : prev.filter(mid => mid !== m.id))} />
            <span>{m.kind === 'image' ? 'Изображение' : m.kind === 'text' ? 'Ваш текст' : 'AI-текст'} · {m.content.slice(0, 180) || new Date(m.created_at).toLocaleString('ru-RU')}</span>
          </label>)}
          {moreMaterials && <Button variant="outline" onClick={() => void more()}>Загрузить ещё варианты</Button>}
          <Button disabled={busy || selected.length > 12} onClick={async () => { try { await flush(); setPreview(true) } catch (e) { report(e) } }}>Предпросмотр</Button>
        </> : <>
          <HighlightComposition quote={data.text_content} publication={composition} />
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setPreview(false)}>Изменить состав</Button><Button disabled={busy || !data.permissions.publish || conflict} onClick={() => void publish(true)}>{data.is_public ? 'Обновить публикацию' : 'Опубликовать'}</Button></div>
        </>}
        {data.is_public && <Button variant="outline" disabled={busy} onClick={() => void publish(false)}>Снять с публикации</Button>}
        <p className="text-sm text-cf-text-3">Публичная карточка меняется только после подтверждения публикации.</p>
      </section>}
      {busy && <Button variant="outline" onClick={() => abort.current?.abort()}>Отменить генерацию</Button>}
    </>}
    {onClose && <Button variant="outline" onClick={() => void close()}>Сохранить и закрыть</Button>}
  </div>

  if (!onClose) return <div className="mx-auto max-w-4xl px-5 py-10">{body}</div>
  return <Dialog open onOpenChange={open => { if (!open) void close() }}><DialogContent className="max-h-[94dvh] overflow-y-auto bg-cf-bg text-cf-text-1 sm:max-w-4xl"><DialogTitle className="sr-only">Мастерская highlight</DialogTitle>{body}</DialogContent></Dialog>
}
