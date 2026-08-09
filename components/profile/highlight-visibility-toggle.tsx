'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface HighlightVisibilityToggleProps {
  highlightId: string
  initialIsPublic: boolean
}

/**
 * Тумблер публичности цитаты в профиле.
 * Публичная цитата дополнительно получает ссылку «Поделиться».
 */
export function HighlightVisibilityToggle({
  highlightId,
  initialIsPublic,
}: HighlightVisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    const next = !isPublic
    startTransition(async () => {
      const res = await fetch(`/api/chapter-highlights/${highlightId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Не удалось изменить видимость')
        return
      }
      setIsPublic(next)
      toast.success(next ? 'Цитата стала публичной' : 'Цитата стала приватной')
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={isPublic}
        title={isPublic ? 'Сделать приватной' : 'Сделать публичной'}
        className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] transition-opacity hover:opacity-70 disabled:opacity-40 ${
          isPublic ? 'text-cf-warm' : 'text-cf-text-4'
        }`}
      >
        {isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {isPublic ? 'публичная' : 'приватная'}
      </button>

      {isPublic && (
        <Link
          href={`/highlight/${highlightId}`}
          className="text-[10px] font-black uppercase tracking-[0.18em] text-cf-warm hover:underline"
        >
          Поделиться
        </Link>
      )}
    </div>
  )
}
