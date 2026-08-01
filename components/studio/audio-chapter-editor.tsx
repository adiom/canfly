'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { put } from '@vercel/blob/client'
import { toast } from 'sonner'
import { Headphones, Loader2, Mic2, Music2, Save, Trash2, Upload } from 'lucide-react'
import type { Chapter, ChapterLyrics } from '@/lib/releases-types'
import { extractLyrics } from '@/lib/releases-types'
import {
  applyAudioCoverToReleaseAction,
  finalizeAudioChapterUploadAction,
  removeAudioChapterFileAction,
  updateChapterAction,
} from '@/lib/actions/studio'
import { formatDuration } from '@/lib/utils/editions'
import { parseLrc, serializeLrc, findActiveLine } from '@/lib/utils/lyrics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface AudioChapterEditorProps {
  chapter: Chapter
  onSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void
}

const MAX_AUDIO_SIZE = 500 * 1024 * 1024
const ACCEPTED_AUDIO = '.mp3,.m4a,.aac,.ogg,.wav,.flac,audio/*'

function stringMeta(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function numberMeta(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

type LyricsMode = 'edit' | 'sync' | 'preview'

export function AudioChapterEditor({ chapter, onSaveStatus }: AudioChapterEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const syncLineRef = useRef<HTMLDivElement>(null)
  const initialMetadata = useMemo(() => chapter.audio_metadata ?? {}, [chapter.audio_metadata])
  const [title, setTitle] = useState(chapter.title)
  const [audioUrl, setAudioUrl] = useState(chapter.audio_url ?? '')
  const [durationSeconds, setDurationSeconds] = useState<number | null>(chapter.duration_seconds)
  const [artist, setArtist] = useState(stringMeta(initialMetadata, 'artist'))
  const [album, setAlbum] = useState(stringMeta(initialMetadata, 'album'))
  const [year, setYear] = useState(numberMeta(initialMetadata, 'year')?.toString() ?? '')
  const [trackNo, setTrackNo] = useState(numberMeta(initialMetadata, 'trackNo')?.toString() ?? '')
  const [codec, setCodec] = useState(stringMeta(initialMetadata, 'codec'))
  const [bitrate, setBitrate] = useState(numberMeta(initialMetadata, 'bitrate'))
  const [sampleRate, setSampleRate] = useState(numberMeta(initialMetadata, 'sampleRate'))
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isPending, startTransition] = useTransition()

  const initialLyrics = useMemo(() => extractLyrics(initialMetadata), [initialMetadata])
  const [lyrics, setLyrics] = useState<ChapterLyrics | null>(initialLyrics)
  const [lyricsText, setLyricsText] = useState(() => initialLyrics ? serializeLrc(initialLyrics) : '')
  const [lyricsMode, setLyricsMode] = useState<LyricsMode>('edit')
  const [syncCurrentLine, setSyncCurrentLine] = useState(0)
  const [syncCurrentTime, setSyncCurrentTime] = useState(0)
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0)

  const canSave = title.trim().length > 0 && !uploading && !isPending

  const buildMetadata = useCallback(() => ({
    ...initialMetadata,
    artist: artist.trim() || undefined,
    album: album.trim() || undefined,
    year: year.trim() ? Number(year) : undefined,
    trackNo: trackNo.trim() ? Number(trackNo) : undefined,
    codec: codec || undefined,
    bitrate: bitrate ?? undefined,
    sampleRate: sampleRate ?? undefined,
    lyrics: lyrics ?? undefined,
  }), [album, artist, bitrate, codec, initialMetadata, lyrics, sampleRate, trackNo, year])

  const parseLyricsText = useCallback((text: string) => {
    if (!text.trim()) {
      setLyrics(null)
      return
    }
    const parsed = parseLrc(text)
    setLyrics(parsed)
  }, [])

  useEffect(() => {
    if (lyricsMode !== 'preview') return
    const audio = previewAudioRef.current
    if (!audio) return
    const handler = () => setPreviewCurrentTime(audio.currentTime)
    audio.addEventListener('timeupdate', handler)
    return () => audio.removeEventListener('timeupdate', handler)
  }, [lyricsMode])

  useEffect(() => {
    if (lyricsMode !== 'sync') return
    const audio = previewAudioRef.current
    if (!audio) return
    const handler = () => setSyncCurrentTime(audio.currentTime)
    audio.addEventListener('timeupdate', handler)
    return () => audio.removeEventListener('timeupdate', handler)
  }, [lyricsMode])

  useEffect(() => {
    if (lyricsMode !== 'sync' || !lyrics?.lines[syncCurrentLine]) return
    syncLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [syncCurrentLine, lyricsMode, lyrics])

  function stampCurrentLine() {
    if (!lyrics) return
    const audio = previewAudioRef.current
    if (!audio) return
    const time = audio.currentTime
    const lines = lyrics.lines.map((l, i) =>
      i === syncCurrentLine ? { ...l, time } : l
    )
    const updated: ChapterLyrics = { format: 'synced', lines }
    setLyrics(updated)
    setLyricsText(serializeLrc(updated))
    if (syncCurrentLine + 1 < lyrics.lines.length) {
      setSyncCurrentLine(syncCurrentLine + 1)
    }
  }

  function advanceSyncLine() {
    if (!lyrics) return
    const next = syncCurrentLine + 1
    if (next < lyrics.lines.length) setSyncCurrentLine(next)
  }

  function retreatSyncLine() {
    if (syncCurrentLine > 0) setSyncCurrentLine(syncCurrentLine - 1)
  }

  const uploadAudio = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|ogg|wav|flac)$/i.test(file.name)) {
      toast.error('Поддерживаются только m4a, mp3, aac, ogg, wav, flac')
      return
    }
    if (file.size > MAX_AUDIO_SIZE) {
      toast.error('Аудиофайл больше 500 МБ')
      return
    }

    setUploading(true)
    setProgress(0)
    onSaveStatus('saving')

    try {
      const tokenResponse = await fetch('/api/studio/upload/audio/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: chapter.id,
          filename: file.name,
          contentType: file.type || 'audio/mpeg',
          size: file.size,
        }),
      })
      const tokenData = await tokenResponse.json()
      if (!tokenResponse.ok || !tokenData.token || !tokenData.pathname) {
        throw new Error(tokenData.error ?? 'Не удалось подготовить загрузку')
      }

      const blob = await put(tokenData.pathname, file, {
        access: 'public',
        token: tokenData.token,
        contentType: file.type || undefined,
        multipart: file.size > 100 * 1024 * 1024,
        onUploadProgress: event => setProgress(event.percentage),
      })

      const result = await finalizeAudioChapterUploadAction(chapter.id, {
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType ?? file.type,
        size: file.size,
      })

      if (!result?.chapter) throw new Error('Не удалось сохранить аудиотрек')

      const updated = result.chapter
      const metadata = updated.audio_metadata ?? {}
      setTitle(updated.title)
      setAudioUrl(updated.audio_url ?? '')
      setDurationSeconds(updated.duration_seconds)
      setArtist(stringMeta(metadata, 'artist'))
      setAlbum(stringMeta(metadata, 'album'))
      setYear(numberMeta(metadata, 'year')?.toString() ?? '')
      setTrackNo(numberMeta(metadata, 'trackNo')?.toString() ?? '')
      setCodec(stringMeta(metadata, 'codec'))
      setBitrate(numberMeta(metadata, 'bitrate'))
      setSampleRate(numberMeta(metadata, 'sampleRate'))
      setCoverUrl(result.coverUrl)
      onSaveStatus('saved')
      toast.success('Аудиотрек загружен')
    } catch (error) {
      onSaveStatus('error')
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки аудио')
    } finally {
      setUploading(false)
    }
  }, [chapter.id, onSaveStatus])

  const handleFile = useCallback((file: File | null) => {
    if (file) void uploadAudio(file)
  }, [uploadAudio])

  function saveMetadata() {
    if (!canSave) return
    onSaveStatus('saving')
    startTransition(async () => {
      try {
        const updated = await updateChapterAction(chapter.id, {
          title: title.trim(),
          duration_seconds: durationSeconds,
          audio_metadata: buildMetadata(),
        })
        if (updated) {
          setTitle(updated.title)
          onSaveStatus('saved')
          toast.success('Трек сохранён')
        }
      } catch {
        onSaveStatus('error')
        toast.error('Ошибка сохранения')
      }
    })
  }

  function removeAudio() {
    startTransition(async () => {
      onSaveStatus('saving')
      try {
        const updated = await removeAudioChapterFileAction(chapter.id)
        if (updated) {
          setAudioUrl('')
          setDurationSeconds(null)
          setArtist('')
          setAlbum('')
          setYear('')
          setTrackNo('')
          setCodec('')
          setBitrate(null)
          setSampleRate(null)
          setCoverUrl(null)
        }
        onSaveStatus('saved')
        toast.success('Аудиофайл удалён')
      } catch {
        onSaveStatus('error')
        toast.error('Ошибка удаления аудио')
      }
    })
  }

  function applyCover() {
    if (!coverUrl) return
    startTransition(async () => {
      try {
        await applyAudioCoverToReleaseAction(chapter.id, coverUrl)
        toast.success('Обложка релиза обновлена')
        setCoverUrl(null)
      } catch {
        toast.error('Не удалось обновить обложку')
      }
    })
  }

  const previewActiveLine = lyrics?.format === 'synced'
    ? findActiveLine(lyrics.lines, previewCurrentTime)
    : -1

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div
        onDragOver={event => {
          event.preventDefault()
          if (!uploading) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={event => {
          event.preventDefault()
          setDragOver(false)
          handleFile(event.dataTransfer.files?.[0] ?? null)
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed bg-white/60 p-6 text-center shadow-sm shadow-black/5 transition-colors',
          dragOver ? 'border-violet-400 bg-violet-50/70' : 'border-white/70',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_AUDIO}
          className="hidden"
          onChange={event => {
            handleFile(event.target.files?.[0] ?? null)
            event.target.value = ''
          }}
        />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </div>
        <h2 className="text-lg font-bold text-gray-900">Загрузите аудиофайл</h2>
        <p className="mt-1 text-sm text-gray-500">m4a, mp3, aac, ogg, wav, flac · до 500 МБ</p>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || isPending}
          className="mt-4 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
        >
          {uploading ? 'Загружаю...' : 'Выбрать файл'}
        </Button>
        {uploading && (
          <div className="mx-auto mt-4 max-w-md">
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-500">{progress}%</p>
          </div>
        )}
      </div>

      {/* Track metadata */}
      <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Данные трека</h3>
            <p className="text-xs text-gray-400">Теги можно исправить вручную</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-gray-600">Название</Label>
            <Input value={title} onChange={event => setTitle(event.target.value)} className="rounded-xl bg-white/70" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-600">Автор / артист</Label>
            <Input value={artist} onChange={event => setArtist(event.target.value)} className="rounded-xl bg-white/70" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-600">Альбом</Label>
            <Input value={album} onChange={event => setAlbum(event.target.value)} className="rounded-xl bg-white/70" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-600">Год</Label>
            <Input value={year} onChange={event => setYear(event.target.value.replace(/\D/g, '').slice(0, 4))} className="rounded-xl bg-white/70" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-600">Номер трека</Label>
            <Input value={trackNo} onChange={event => setTrackNo(event.target.value.replace(/\D/g, '').slice(0, 4))} className="rounded-xl bg-white/70" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl border border-white/70 bg-white/50 p-4 text-sm text-gray-500 sm:grid-cols-3">
          <div><span className="block text-xs uppercase tracking-wide text-gray-400">Длительность</span>{durationSeconds ? formatDuration(durationSeconds) : 'Не определена'}</div>
          <div><span className="block text-xs uppercase tracking-wide text-gray-400">Кодек</span>{codec || 'Не определён'}</div>
          <div><span className="block text-xs uppercase tracking-wide text-gray-400">Битрейт</span>{bitrate ? `${Math.round(bitrate / 1000)} kbps` : 'Не определён'}</div>
          <div><span className="block text-xs uppercase tracking-wide text-gray-400">Sample rate</span>{sampleRate ? `${sampleRate} Hz` : 'Не определён'}</div>
          <div className="sm:col-span-2"><span className="block text-xs uppercase tracking-wide text-gray-400">URL</span><span className="break-all">{audioUrl || 'Файл не загружен'}</span></div>
        </div>

        {audioUrl && (
          <audio ref={previewAudioRef} controls src={audioUrl} className="mt-5 w-full" preload="metadata" />
        )}

        {coverUrl && (
          <div className="mt-5 flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-amber-100">
              <Image src={coverUrl} alt="Обложка из аудиофайла" fill sizes="80px" className="object-cover" unoptimized />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">В файле найдена обложка</p>
              <p className="text-xs text-amber-700">Можно применить её как обложку релиза.</p>
            </div>
            <Button type="button" variant="outline" onClick={applyCover} disabled={isPending} className="rounded-xl bg-white/70">
              Применить
            </Button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {audioUrl && (
            <Button type="button" variant="outline" onClick={removeAudio} disabled={uploading || isPending} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить аудио
            </Button>
          )}
          <Button type="button" onClick={saveMetadata} disabled={!canSave} className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Сохранить
          </Button>
        </div>
      </div>

      {/* Lyrics editor */}
      <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Mic2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Слова песни</h3>
            <p className="text-xs text-gray-400">LRC-формат с таймкодами или обычный текст</p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="mb-4 flex gap-1 rounded-xl bg-gray-100/70 p-1">
          <button
            type="button"
            onClick={() => setLyricsMode('edit')}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all',
              lyricsMode === 'edit'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Ввод
          </button>
          {audioUrl && (
            <button
              type="button"
              onClick={() => {
                if (lyricsText.trim()) parseLyricsText(lyricsText)
                setLyricsMode('sync')
              }}
              disabled={!lyricsText.trim()}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all',
                lyricsMode === 'sync'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 disabled:opacity-40',
              )}
            >
              Синхронизация
            </button>
          )}
          {audioUrl && lyrics?.format === 'synced' && (
            <button
              type="button"
              onClick={() => setLyricsMode('preview')}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all',
                lyricsMode === 'preview'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              Превью
            </button>
          )}
        </div>

        {/* EDIT mode */}
        {lyricsMode === 'edit' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-3 text-xs text-violet-700">
              <p className="font-semibold">LRC-формат:</p>
              <code className="mt-1 block text-violet-500">[00:12.50] Строка с таймкодом</code>
              <p className="mt-1 text-violet-600">Строки с <code>[mm:ss.ms]</code> → синхронизированный режим. Строки без меток → обычный текст.</p>
            </div>
            <textarea
              value={lyricsText}
              onChange={e => {
                setLyricsText(e.target.value)
                parseLyricsText(e.target.value)
              }}
              placeholder="[00:15.00] Первая строка песни&#10;[00:19.50] Вторая строка&#10;&#10;Или просто текст без таймкодов"
              className="w-full min-h-[200px] rounded-xl border border-white/70 bg-white/70 p-4 text-sm leading-7 text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 font-mono"
              spellCheck={false}
            />
            {lyrics && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={cn(
                  'rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide',
                  lyrics.format === 'synced' ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-600',
                )}>
                  {lyrics.format === 'synced' ? 'Синхронизировано' : 'Обычный текст'}
                </span>
                <span>{lyrics.lines.length} строк</span>
                {lyrics.format === 'synced' && (
                  <span>{lyrics.lines.filter(l => l.time !== undefined).length} с таймкодами</span>
                )}
              </div>
            )}
            {lyricsText.trim() && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setLyricsText(''); setLyrics(null) }}
                className="rounded-xl text-gray-400 hover:text-red-500"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Очистить
              </Button>
            )}
          </div>
        )}

        {/* SYNC mode */}
        {lyricsMode === 'sync' && lyrics && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 text-xs text-amber-700">
              <p className="font-semibold">Ручная синхронизация</p>
              <p className="mt-1">Запустите аудио. Когда строка звучит — нажмите <kbd className="rounded bg-amber-200 px-1.5 py-0.5 font-mono text-amber-800">Поставить метку</kbd> или <kbd className="rounded bg-amber-200 px-1.5 py-0.5 font-mono text-amber-800">Enter</kbd>. Таймкод текущей позиции запишется в строку, курсор перейдёт к следующей.</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/70 bg-white/50">
              {lyrics.lines.map((line, i) => (
                <div
                  key={i}
                  ref={i === syncCurrentLine ? syncLineRef : undefined}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 border-b border-white/40 transition-all',
                    i === syncCurrentLine ? 'bg-amber-100/80' : 'bg-transparent',
                    line.time !== undefined ? 'opacity-90' : 'opacity-40',
                  )}
                >
                  <span className="min-w-[52px] text-xs tabular-nums font-mono text-gray-400">
                    {line.time !== undefined ? formatDuration(Math.floor(line.time)) : '--:--'}
                  </span>
                  <span className={cn(
                    'text-sm',
                    i === syncCurrentLine ? 'font-semibold text-amber-800' : 'text-gray-600',
                  )}>
                    {line.text}
                  </span>
                  {i === syncCurrentLine && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white text-[10px] font-bold">
                      ▶
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={stampCurrentLine}
                disabled={syncCurrentLine >= lyrics.lines.length}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-md shadow-amber-500/25 hover:from-amber-600 hover:to-amber-500"
              >
                Поставить метку
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={retreatSyncLine}
                disabled={syncCurrentLine <= 0}
                className="rounded-xl"
              >
                ← Назад
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={advanceSyncLine}
                disabled={syncCurrentLine >= lyrics.lines.length - 1}
                className="rounded-xl"
              >
                Следующая строка →
              </Button>
              <span className="text-xs text-gray-400">
                Строка {syncCurrentLine + 1} / {lyrics.lines.length} · {formatDuration(Math.floor(syncCurrentTime))}
              </span>
            </div>
          </div>
        )}

        {/* PREVIEW mode */}
        {lyricsMode === 'preview' && lyrics && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-xs text-emerald-700">
              <p className="font-semibold">Превью — как увидит слушатель</p>
              <p className="mt-1">Активная строка подсвечивается при воспроизведении. Клик по строке перематывает аудио.</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto rounded-xl bg-gray-900 p-4">
              {lyrics.lines.map((line, i) => {
                const isActive = i === previewActiveLine
                const isPast = i < previewActiveLine
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (line.time !== undefined && previewAudioRef.current) {
                        previewAudioRef.current.currentTime = line.time
                      }
                    }}
                    className={cn(
                      'block w-full text-left px-2 py-1.5 rounded-lg transition-all duration-300',
                      isActive && 'text-cf-accent font-bold text-base scale-[1.02]',
                      isPast && !isActive && 'text-gray-400 text-sm',
                      !isActive && !isPast && 'text-gray-500 text-sm',
                    )}
                  >
                    {line.text}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!audioUrl && lyricsText.trim() && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
            <Music2 className="mr-1.5 inline h-3.5 w-3.5" />
            Синхронизация и превью доступны после загрузки аудиофайла.
          </div>
        )}
      </div>

      {!audioUrl && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Music2 className="mr-2 inline h-4 w-4" />
          Трек без аудиофайла не будет воспроизводиться в публичном плеере.
        </div>
      )}
    </div>
  )
}
