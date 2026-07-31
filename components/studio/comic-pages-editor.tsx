'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus, Trash2, Check, Loader2 } from 'lucide-react'
import { updateComicChapterPagesAction } from '@/lib/actions/studio'

interface ComicPagesEditorProps {
  chapterId: string
  initialPages: string[]
}

export function ComicPagesEditor({ chapterId, initialPages }: ComicPagesEditorProps) {
  const [pages, setPages] = useState<string[]>(initialPages)
  const [uploading, setUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function persist(newPages: string[]) {
    setSaved(false)
    startTransition(async () => {
      try {
        await updateComicChapterPagesAction(chapterId, newPages)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch {
        toast.error('Ошибка сохранения')
      }
    })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/studio/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Failed to upload ${file.name}: ${errorData.error || res.statusText}`)
        }

        const data = await res.json()
        uploadedUrls.push(data.url)
      }

      const newPages = [...pages, ...uploadedUrls]
      setPages(newPages)
      persist(newPages)
      toast.success(`Загружено ${uploadedUrls.length} страниц`)
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleAddByUrl() {
    const url = window.prompt('URL изображения:')
    if (url) {
      const newPages = [...pages, url]
      setPages(newPages)
      persist(newPages)
    }
  }

  function handleDelete(index: number) {
    const newPages = pages.filter((_, i) => i !== index)
    setPages(newPages)
    persist(newPages)
    toast.success('Страница удалена')
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newPages = [...pages]
    const draggedItem = newPages[draggedIndex]
    newPages.splice(draggedIndex, 1)
    newPages.splice(index, 0, draggedItem)

    setPages(newPages)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    if (draggedIndex !== null) {
      persist(pages)
    }
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Страницы комикса ({pages.length})</h3>
          <span className="text-xs text-muted-foreground">
            {isPending && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
            {!isPending && saved && <Check className="inline h-3 w-3 text-emerald-500 mr-1" />}
            {isPending ? 'Сохраняю...' : saved ? 'Сохранено' : ''}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAddByUrl}>
            + URL
          </Button>
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={e => {
                e.preventDefault()
                const input = e.currentTarget.previousElementSibling as HTMLInputElement | null
                if (input) input.click()
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              {uploading ? 'Загрузка...' : 'Загрузить'}
            </Button>
          </label>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-16 text-center">
          <p className="text-gray-400">Страницы не добавлены. Загрузите изображения или добавьте по URL.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {pages.map((url, index) => (
            <div
              key={`${url}-${index}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group cursor-move rounded-xl overflow-hidden border border-white/70 shadow-sm ${
                draggedIndex === index ? 'opacity-50' : ''
              }`}
            >
              <div className="relative aspect-[3/4] bg-muted">
                <Image
                  src={url}
                  alt={`Страница ${index + 1}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs text-white font-medium mr-2">{index + 1}</span>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">Перетаскивайте карточки для изменения порядка</p>
    </div>
  )
}
