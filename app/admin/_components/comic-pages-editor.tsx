'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ComicPagesEditorProps {
  bookId: string
  initialPages: string[]
  onUpdate: (pages: string[]) => void
}

export function ComicPagesEditor({ initialPages, onUpdate }: ComicPagesEditorProps) {
  const [pages, setPages] = useState<string[]>(initialPages || [])
  const [uploading, setUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include', // Важно для передачи cookies
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
      onUpdate(newPages)
      toast.success(`Загружено ${uploadedUrls.length} страниц`)
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Ошибка загрузки')
    } finally {
      setUploading(false)
      e.target.value = '' // Reset input
    }
  }

  const handleDelete = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index)
    setPages(newPages)
    onUpdate(newPages)
    toast.success('Страница удалена')
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newPages = [...pages]
    const draggedItem = newPages[draggedIndex]
    newPages.splice(draggedIndex, 1)
    newPages.splice(index, 0, draggedItem)

    setPages(newPages)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    onUpdate(pages)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#f4efe5]">
          Страницы комикса ({pages.length})
        </h3>
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
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={(e) => {
              e.preventDefault()
              ;(e.currentTarget.previousElementSibling as HTMLInputElement)?.click()
            }}
          >
            {uploading ? 'Загрузка...' : '+ Добавить страницы'}
          </Button>
        </label>
      </div>

      {pages.length === 0 ? (
        <div className="border border-dashed border-[#f4efe5]/20 rounded-lg p-8 text-center">
          <p className="text-sm text-[#f4efe5]/40">Страницы не добавлены</p>
          <p className="text-xs text-[#f4efe5]/30 mt-1">
            Загрузите изображения для комикса
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {pages.map((url, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group cursor-move border border-[#f4efe5]/10 rounded overflow-hidden ${
                draggedIndex === index ? 'opacity-50' : ''
              }`}
            >
              <div className="relative aspect-[3/4] bg-[#1b1c19]">
                <Image
                  src={url}
                  alt={`Страница ${index + 1}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
              
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <span className="text-xs text-white font-medium">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="p-1.5 bg-red-600 hover:bg-red-700 rounded text-white transition-colors"
                  title="Удалить"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[#f4efe5]/30">
        Перетаскивайте карточки для изменения порядка страниц
      </p>
    </div>
  )
}
