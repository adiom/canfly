'use client'

import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { useState } from 'react'
import { toast } from 'sonner'
import { createEditionAction } from '@/lib/actions/studio'
import { Button } from '@/components/ui/button'
import {
  BookOpen, Image, Headphones, Newspaper, Radio, Globe,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

const formats = [
  { value: 'book', label: 'Книга', desc: 'Текстовое произведение с главами', icon: BookOpen, gradient: 'from-violet-200 to-violet-50' },
  { value: 'comic', label: 'Комикс', desc: 'Визуальное повествование, страницы', icon: Image, gradient: 'from-rose-200 to-rose-50' },
  { value: 'audiobook', label: 'Аудиокнига', desc: 'Озвученное произведение', icon: Headphones, gradient: 'from-amber-200 to-amber-50' },
  { value: 'audiorelease', label: 'Аудиорелиз', desc: 'Альбом, подкаст, аудио-сингл', icon: Radio, gradient: 'from-sky-200 to-sky-50' },
  { value: 'magazine', label: 'Журнал', desc: 'Статьи и материалы в сборнике', icon: Newspaper, gradient: 'from-orange-200 to-orange-50' },
  { value: 'digital', label: 'Цифровой релиз', desc: 'Книга на других площадках: Litres, Amazon и т.д.', icon: Globe, gradient: 'from-emerald-200 to-emerald-50' },
]

const bookTiers = [
  { value: 'draft', label: 'Черновик', desc: 'Неотредактированная версия' },
  { value: 'standard', label: 'Книга', desc: 'Основная версия' },
  { value: 'premium', label: 'Иллюстрированная', desc: 'С иллюстрациями и полной обработкой' },
] as const

export function EditionFormatSelector({ releaseId }: { releaseId: string }) {
  const [creating, setCreating] = useState<string | null>(null)
  const [showBookTiers, setShowBookTiers] = useState(false)

  async function handleSelect(format: string, qualityTier?: string) {
    setCreating(format + (qualityTier ?? ''))
    try {
      const formData = new FormData()
      formData.set('release_id', releaseId)
      formData.set('format', format)
      // Тираж едет полем quality_tier. Раньше он кодировался в слаге
      // (web-draft / web-book / premium), а в БД уходил дефолтный 'standard'.
      formData.set('quality_tier', qualityTier ?? 'standard')
      await createEditionAction(formData)
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка создания издания')
      setCreating(null)
    }
  }

  if (showBookTiers) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowBookTiers(false)} className="rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад к форматам
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Тип книжного издания</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {bookTiers.map(tier => {
            const isLoading = creating === 'book' + tier.value
            return (
              <button
                key={tier.value}
                onClick={() => handleSelect('book', tier.value)}
                disabled={isLoading}
                className={`group bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-8 text-center transition-all duration-300 hover:bg-white/80 hover:shadow-md hover:shadow-black/8 hover:-translate-y-0.5 hover:border-white/90 ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
              >
                <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-xl bg-gradient-to-br from-violet-200 to-violet-50 shadow-sm mb-4">
                  <BookOpen className="h-7 w-7 text-gray-600 group-hover:text-violet-600 transition-colors" />
                </div>
                <span className="text-lg font-bold text-gray-900">{tier.label}</span>
                <span className="block mt-2 text-sm text-gray-400">{tier.desc}</span>
                {isLoading && (
                  <span className="block mt-3 text-xs text-violet-500 animate-pulse">Создаю...</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex items-center gap-4">
        <Link href={`/studio/releases/${releaseId}`}>
          <Button variant="ghost" className="rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К релизу
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Выберите формат издания</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formats.map(f => {
          const Icon = f.icon
          const isLoading = creating === f.value
          return (
            <button
              key={f.value}
              onClick={() => {
                if (f.value === 'book') {
                  setShowBookTiers(true)
                } else {
                  handleSelect(f.value)
                }
              }}
              disabled={isLoading}
              className={`group bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-8 text-center transition-all duration-300 hover:bg-white/80 hover:shadow-md hover:shadow-black/8 hover:-translate-y-0.5 hover:border-white/90 ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <div className={`flex h-14 w-14 mx-auto items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} shadow-sm mb-4`}>
                <Icon className="h-7 w-7 text-gray-600 group-hover:text-violet-600 transition-colors" />
              </div>
              <span className="text-lg font-bold text-gray-900">{f.label}</span>
              <span className="block mt-2 text-sm text-gray-400">{f.desc}</span>
              {isLoading && (
                <span className="block mt-3 text-xs text-violet-500 animate-pulse">Создаю...</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}