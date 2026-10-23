'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { updateArtworkImageAction } from '@/lib/actions/studio'
import { Button } from '@/components/ui/button'
import { ImagePlus, Loader2, Upload } from 'lucide-react'

export function ArtworkImageEditor({
  editionId,
  initialImageUrl,
}: {
  editionId: string
  initialImageUrl: string | null
}) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/studio/upload', { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok || typeof result.url !== 'string') {
        throw new Error(result.error || 'Не удалось загрузить изображение')
      }

      await updateArtworkImageAction(editionId, result.url)
      setImageUrl(result.url)
      toast.success('Изображение сохранено')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки изображения')
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5 md:p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Изображение картины</h2>
        <p className="mt-1 text-sm text-gray-500">
          PNG, JPEG, GIF, WebP или AVIF, до 10 МБ. Обложка релиза настраивается отдельно.
        </p>
      </div>

      {imageUrl ? (
        <div className="relative aspect-[4/3] max-h-[32rem] overflow-hidden rounded-xl bg-gray-950">
          <Image src={imageUrl} alt="Предпросмотр картины" fill sizes="(max-width: 768px) 100vw, 768px" className="object-contain" />
        </div>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white/40 text-center">
          <ImagePlus className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500">Изображение ещё не загружено</p>
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          onChange={handleUpload}
          disabled={uploading}
          className="sr-only"
        />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading ? 'Загружаю...' : imageUrl ? 'Заменить изображение' : 'Загрузить изображение'}
        </Button>
      </div>
    </section>
  )
}
