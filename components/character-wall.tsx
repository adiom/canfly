'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import type { CharacterWallPostWithUser } from '@/lib/types'

interface CharacterWallProps {
  slug: string
  initialPosts: CharacterWallPostWithUser[]
  currentUserId: string | null
  isAdmin: boolean
}

const MAX_LENGTH = 2000

export function CharacterWall({ slug, initialPosts, currentUserId, isAdmin }: CharacterWallProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<CharacterWallPostWithUser[]>(initialPosts)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/characters/${slug}/wall`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload?.error ?? 'Не удалось оставить запись')
        return
      }
      setContent('')
      router.refresh()
    } catch {
      setError('Сетевая ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить запись?')) return
    const response = await fetch(`/api/characters/${slug}/wall/${id}`, {
      method: 'DELETE',
    })
    if (response.ok) {
      setPosts((current) => current.filter((p) => p.id !== id))
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="cf-glass space-y-3 rounded-3xl p-5">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.24em] text-cf-air-accent-ink">
          Оставить запись на стене
        </h3>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
          rows={3}
          maxLength={MAX_LENGTH}
          placeholder="Что ты хочешь сказать этому персонажу?"
          className="rounded-2xl border-cf-air-line bg-cf-air-surface"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-cf-text-3">
            {content.length} / {MAX_LENGTH}
          </span>
          <Button
            type="submit"
            disabled={submitting || !content.trim()}
            className="h-11 rounded-full bg-cf-air-accent px-6 font-medium text-white hover:bg-cf-air-accent-ink"
          >
            {submitting ? 'Публикация…' : 'Опубликовать'}
          </Button>
        </div>
        {error ? <p className="text-sm text-cf-accent">{error}</p> : null}
        <p className="text-xs text-cf-text-3">
          Запись появится на стене после публикации. Можно удалить свою запись в любой момент.
        </p>
      </form>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <p className="py-8 text-center text-cf-text-3">На стене пока никого нет</p>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="cf-glass rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-cf-text-1">{post.user.display_name}</span>
                    <span className="text-cf-text-3">@{post.user.handle}</span>
                    <span className="text-xs text-cf-text-4">
                      · {new Date(post.created_at).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-cf-text-caption">
                    {post.content}
                  </p>
                </div>
                {currentUserId === post.user_id || isAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(post.id)}
                    aria-label="Удалить запись"
                    className="rounded-full text-cf-text-3 hover:text-cf-accent"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
