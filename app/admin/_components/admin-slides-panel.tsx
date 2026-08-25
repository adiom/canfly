'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { HomepageSlide } from '@/lib/types'
import { deleteSlideAction } from '@/lib/actions/admin-slides'

interface AdminSlidesPanelProps {
  slides: HomepageSlide[]
}

export function AdminSlidesPanel({ slides }: AdminSlidesPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function remove(slide: HomepageSlide) {
    if (!window.confirm(`Удалить слайд «${slide.title}»?`)) return

    setError('')
    const result = await deleteSlideAction(slide.id)
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Слайды главной</h2>
          <p className="mt-1 text-sm text-slate-400">Порядок и видимость — на главной странице.</p>
        </div>
        <Link href="/admin/homepage-slides/new">
          <Button className="bg-purple-600 hover:bg-purple-700">Добавить слайд</Button>
        </Link>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {slides.length > 0 ? (
          slides.map((slide) => (
            <div
              key={slide.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800 p-6"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{slide.title}</h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      slide.is_active ? 'bg-green-900/50 text-green-200' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {slide.is_active ? 'активен' : 'скрыт'}
                  </span>
                  <span className="rounded-full bg-slate-950 px-2 py-1 text-xs text-slate-400">
                    #{slide.display_order}
                  </span>
                  <span className="rounded-full bg-slate-950 px-2 py-1 text-xs text-slate-400">
                    {slide.theme}
                  </span>
                </div>
                {slide.eyebrow ? <p className="text-sm text-slate-400">{slide.eyebrow}</p> : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/admin/homepage-slides/${slide.id}/edit`}>
                  <Button variant="outline" size="sm">Редактировать</Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="text-red-400 hover:text-red-300"
                  onClick={() => remove(slide)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-400">Слайдов пока нет</div>
        )}
      </div>
    </div>
  )
}
