"use client"

import { useCallback, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import type { Edition } from '@/lib/releases-types'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Headphones, Image, Music, Newspaper, Radio } from 'lucide-react'

const formatIcons: Record<string, React.ElementType> = {
  book: BookOpen,
  comic: Image,
  audiobook: Headphones,
  audiorelease: Radio,
  album: Music,
  magazine: Newspaper,
}

const formatLabels: Record<string, string> = {
  book: 'Книга',
  comic: 'Комикс',
  audiobook: 'Аудиокнига',
  audiorelease: 'Аудиорелиз',
  album: 'Альбом',
  magazine: 'Журнал',
}

const statusBadgeStyles: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-600 border-amber-200/80',
  published: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
  archived: 'bg-gray-100 text-gray-500 border-gray-200/80',
}

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  archived: 'Архив',
}

const formatGradients: Record<string, string> = {
  book: 'from-violet-100 to-violet-50',
  comic: 'from-rose-100 to-rose-50',
  audiobook: 'from-amber-100 to-amber-50',
  audiorelease: 'from-sky-100 to-sky-50',
  album: 'from-emerald-100 to-emerald-50',
  magazine: 'from-orange-100 to-orange-50',
}

export function EditionCard({ edition }: { edition: Edition }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(edition.id).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    }
  }, [edition.id])
  const Icon = formatIcons[edition.format] ?? BookOpen
  const gradient = formatGradients[edition.format] ?? 'from-violet-100 to-violet-50'

  return (
    <Link href={`/studio/editions/${edition.id}`}>
      <div className="group bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-4 md:p-5 transition-all duration-300 hover:bg-white/80 hover:shadow-md hover:shadow-black/8 hover:-translate-y-0.5 hover:border-white/90">
        <div className="flex items-center gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}>
            <Icon className="h-5 w-5 text-gray-600 group-hover:text-violet-600 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
              {formatLabels[edition.format]}
            </p>
            {edition.platform && (
              <p className="text-sm text-gray-400">{edition.platform}</p>
            )}
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400 select-all font-mono break-words">{edition.id}</p>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-gray-500 hover:text-gray-700"
                aria-label="Copy edition id"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          
          <Badge variant="outline" className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${statusBadgeStyles[edition.status]}`}>
            {statusLabels[edition.status]}
          </Badge>
        </div>
      </div>
    </Link>
  )
}