'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { jsonRequest, workshopRequest } from './api'
export function HighlightCardActions({ id, userId, own, initialSaved, initialLiked, count }: { id: string; userId: string | null; own: boolean; initialSaved: boolean; initialLiked: boolean; count: number }) {
  const [saved, setSaved] = useState(initialSaved)
  const [liked, setLiked] = useState(initialLiked)
  const [likes, setLikes] = useState(count)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!userId) return <Link className="underline" href={`/login?redirect=/highlight/${id}`}>Войти, чтобы сохранить или поставить лайк</Link>
  const act = async (type: 'like' | 'save') => {
    setBusy(true); setError('')
    try {
      if (type === 'like') {
        const data = await workshopRequest<{ liked: boolean; likes_count: number }>(`/api/chapter-highlights/${id}/like`, jsonRequest('PUT', { liked: !liked }))
        setLiked(data.liked); setLikes(data.likes_count)
      } else {
        await workshopRequest(`/api/chapter-highlights/${id}/save`, jsonRequest('PUT', { saved: !saved }))
        setSaved(!saved)
      }
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">
    <Button variant="outline" disabled={busy} aria-pressed={liked} onClick={() => void act('like')}>♥ {likes}</Button>
    {!own && <Button variant="outline" disabled={busy} onClick={() => void act('save')}>{saved ? 'Убрать из коллекции' : 'Сохранить в коллекцию'}</Button>}
  </div>{error && <p role="alert">{error}</p>}</div>
}
