'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CoverImageUploaderProps {
  value: string | null
  onChange: (url: string | null) => void
  onUploadingChange?: (uploading: boolean) => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'paper'
}

const MAX_SIZE = 10 * 1024 * 1024

export function CoverImageUploader({ value, onChange, onUploadingChange, disabled, className, variant = 'default' }: CoverImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<XMLHttpRequest | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paper = variant === 'paper'
  const busy = disabled || uploading

  useEffect(() => () => { requestRef.current?.abort() }, [])

  function fail(message: string) {
    setError(message)
    toast.error(message)
  }

  function upload(file: File) {
    if (busy || requestRef.current) return
    setError(null)
    if (!file.type.startsWith('image/')) {
      fail('Только изображения')
      return
    }
    if (file.size > MAX_SIZE) {
      fail('Файл больше 10 МБ')
      return
    }

    setUploading(true)
    onUploadingChange?.(true)
    setProgress(0)
    const xhr = new XMLHttpRequest()
    requestRef.current = xhr
    const formData = new FormData()
    formData.append('file', file)

    xhr.upload.addEventListener('progress', event => {
      if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100))
    })
    xhr.addEventListener('load', () => {
      try {
        const data: unknown = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && data && typeof data === 'object' && 'url' in data && typeof data.url === 'string') {
          onChange(data.url)
          toast.success('Обложка загружена. Сохраните основные данные.')
        } else {
          fail(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Ошибка загрузки')
        }
      } catch {
        fail('Ошибка ответа сервера')
      }
    })
    xhr.addEventListener('error', () => fail('Сетевая ошибка. Попробуйте загрузить обложку ещё раз.'))
    xhr.addEventListener('loadend', () => {
      requestRef.current = null
      setUploading(false)
      onUploadingChange?.(false)
    })
    xhr.open('POST', '/api/studio/upload')
    xhr.send(formData)
  }

  function chooseFile() {
    if (!busy) inputRef.current?.click()
  }

  return (
    <div className={cn(paper ? 'paper-cover-block' : 'space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Файл обложки"
        disabled={busy}
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) upload(file)
          event.target.value = ''
        }}
      />
      <div className="relative">
        <button
          type="button"
          aria-label={value ? 'Заменить обложку' : 'Загрузить обложку'}
          title="PNG, JPG, WebP · до 10 МБ"
          disabled={busy}
          onClick={chooseFile}
          onDragOver={event => {
            event.preventDefault()
            if (!busy) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={event => {
            event.preventDefault()
            setDragOver(false)
            const file = event.dataTransfer.files?.[0]
            if (file && !busy) upload(file)
          }}
          className={cn(
            'relative block w-full overflow-hidden transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            paper ? 'paper-cover' : 'rounded-md border-2 border-dashed',
            !paper && (value ? 'aspect-[3/4] max-w-[240px]' : 'min-h-36 p-8'),
            !paper && (dragOver ? 'border-foreground bg-muted/50' : 'border-muted-foreground/25 hover:border-foreground/60'),
            dragOver && 'ring-2 ring-cf-accent',
          )}
        >
          {value ? (
            <Image src={value} alt="Обложка релиза" fill sizes={paper ? '(max-width: 440px) 72px, (max-width: 700px) 85px, 100px' : '240px'} className="object-cover" unoptimized />
          ) : (
            <span className={cn('flex flex-col items-center justify-center gap-2 text-cf-text-3', paper && 'h-full px-2 text-xs')}>
              <ImageIcon className={paper ? 'size-6' : 'size-8'} aria-hidden="true" />
              <span>{paper ? 'Обложка' : 'Загрузите обложку'}</span>
              {!paper && <span className="text-xs">PNG, JPG, WebP · до 10 МБ</span>}
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cf-bg/90 p-2" role="status">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              <span className="h-1 w-full overflow-hidden rounded-full bg-cf-bg-2">
                <span className="block h-full bg-cf-accent" style={{ width: `${progress}%` }} />
              </span>
              <span className="text-xs">{progress}%</span>
            </span>
          )}
        </button>
        {paper && value && (
          <Button type="button" size="icon-sm" variant="outline" className="paper-cover-remove" onClick={() => { onChange(null); setError(null) }} disabled={busy} aria-label="Удалить обложку">
            <X className="size-3" aria-hidden="true" />
          </Button>
        )}
      </div>
      {paper ? (
        <Button type="button" variant="outline" className="paper-button paper-cover-change" onClick={chooseFile} disabled={busy}>
          <Upload className="size-3" aria-hidden="true" />{value ? 'Изменить' : 'Загрузить'}
        </Button>
      ) : value && !uploading ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={chooseFile} disabled={busy}><Upload aria-hidden="true" />Заменить</Button>
          <Button type="button" variant="outline" size="icon" onClick={() => { onChange(null); setError(null) }} disabled={busy} aria-label="Удалить обложку"><X aria-hidden="true" /></Button>
        </div>
      ) : null}
      {error && <p role="alert" className={paper ? 'paper-error' : 'text-xs text-cf-accent'}>{error}</p>}
    </div>
  )
}
