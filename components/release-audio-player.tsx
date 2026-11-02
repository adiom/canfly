'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, List, Mic2, X, ArrowLeft } from 'lucide-react'
import type { Release, Edition, Chapter, ChapterLyrics } from '@/lib/releases-types'
import { extractLyrics } from '@/lib/releases-types'
import { formatDuration, formatTotalDuration } from '@/lib/utils/editions'
import { findActiveLine } from '@/lib/utils/lyrics'

interface ReleaseAudioPlayerProps {
  release: Release
  edition: Edition
  chapters: Chapter[]
  initialChapterIndex?: number
}

function metadataString(chapter: Chapter | undefined, key: string) {
  const value = chapter?.audio_metadata?.[key]
  return typeof value === 'string' ? value : ''
}

export function ReleaseAudioPlayer({ release, chapters, initialChapterIndex = 0 }: ReleaseAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const lyricsLineRef = useRef<HTMLButtonElement>(null)
  const initialPlayableIndex = chapters[initialChapterIndex]?.audio_url
    ? initialChapterIndex
    : chapters.findIndex(chapter => chapter.audio_url)

  const [currentIndex, setCurrentIndex] = useState(initialPlayableIndex >= 0 ? initialPlayableIndex : initialChapterIndex)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showTracklist, setShowTracklist] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [trackError, setTrackError] = useState(false)

  const currentTrack = chapters[currentIndex]
  const currentArtist = metadataString(currentTrack, 'artist')
  const currentAlbum = metadataString(currentTrack, 'album')
  const currentLyrics: ChapterLyrics | null = currentTrack ? extractLyrics(currentTrack.audio_metadata) : null
  const hasLyrics = currentLyrics !== null
  const accent = release.design_config?.accent_color ?? '#d52525'

  const totalDuration = chapters.reduce((sum, ch) => sum + (ch.duration_seconds ?? 0), 0)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.audio_url) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [isPlaying, currentTrack])

  const seek = useCallback((delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta))
  }, [])

  const goToTrack = useCallback((index: number) => {
    setCurrentIndex(index)
    setCurrentTime(0)
    setDuration(0)
    setTrackError(false)
    setShowTracklist(false)
  }, [])

  const findPlayableTrack = useCallback((fromIndex: number, direction: 1 | -1) => {
    for (let i = fromIndex; i >= 0 && i < chapters.length; i += direction) {
      if (chapters[i]?.audio_url) return i
    }
    return -1
  }, [chapters])

  const prevTrack = () => {
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0
      return
    }
    const previous = findPlayableTrack(currentIndex - 1, -1)
    if (previous >= 0) goToTrack(previous)
  }

  const nextTrack = useCallback(() => {
    const next = findPlayableTrack(currentIndex + 1, 1)
    if (next >= 0) goToTrack(next)
    else setIsPlaying(false)
  }, [currentIndex, findPlayableTrack, goToTrack])

  const isPlayingRef = useRef(isPlaying)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.audio_url) return
    const wasPlaying = isPlayingRef.current
    audio.src = currentTrack.audio_url
    audio.load()
    if (wasPlaying) audio.play().catch(() => setIsPlaying(false))
  }, [currentIndex, currentTrack?.audio_url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      if (e.code === 'ArrowLeft') seek(-10)
      if (e.code === 'ArrowRight') seek(10)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, seek])

  useEffect(() => {
    if (!showLyrics || !currentLyrics) return
    const active = findActiveLine(currentLyrics.lines, currentTime)
    if (active < 0) return
    lyricsLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentTime, showLyrics, currentLyrics])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current
    const audio = audioRef.current
    if (!bar || !audio || !audio.duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * audio.duration
  }

  const handleLyricsLineClick = (time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const activeLyricLine = currentLyrics?.format === 'synced'
    ? findActiveLine(currentLyrics.lines, currentTime)
    : -1

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text-1 flex flex-col">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-cf-text-1/10 bg-cf-bg/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-14 items-center justify-center bg-[#d52525] text-sm font-black uppercase tracking-[-0.04em] text-white">
                canfly
              </span>
            </Link>
            <Link
              href={`/release/${release.slug}`}
              aria-label={`О произведении «${release.title}»`}
              title="О произведении"
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] transition-colors hover:bg-cf-text-1/8"
              style={{ borderColor: `${accent}40`, color: accent }}
            >
              <ArrowLeft className="h-3 w-3" />
              <span>О произведении</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {hasLyrics && (
              <button
                onClick={() => { setShowLyrics(!showLyrics); setShowTracklist(false) }}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 hover:text-cf-text-heading transition-colors"
                aria-label="Слова песни"
              >
                <Mic2 className="h-4 w-4" />
                <span className="hidden sm:inline">Слова</span>
              </button>
            )}
            <button
              onClick={() => { setShowTracklist(!showTracklist); setShowLyrics(false) }}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 hover:text-cf-text-heading transition-colors"
              aria-label="Список треков"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Треклист</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={nextTrack}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setIsPlaying(false)
          setTrackError(true)
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-sm">
          {/* Cover */}
          <div className="relative mx-auto mb-10 aspect-square w-full max-w-[280px] overflow-hidden rounded-sm shadow-2xl">
            {release.cover_image ? (
              <Image
                src={release.cover_image}
                alt={release.title}
                fill
                className="object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ backgroundColor: `${accent}22` }}
              >
                <div className="flex h-full items-center justify-center">
                  <span className="text-6xl font-black uppercase opacity-20" style={{ color: accent }}>
                    {release.title[0]}
                  </span>
                </div>
              </div>
            )}
            {isPlaying && (
              <div className="absolute bottom-3 right-3 flex items-end gap-0.5">
                {[1, 2, 3, 4].map(i => (
                  <span
                    key={i}
                    className="w-1 rounded-full animate-pulse"
                    style={{
                      height: `${8 + i * 4}px`,
                      backgroundColor: accent,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.6 + i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="mb-6 text-center">
            <p className="mb-1 text-xs font-black uppercase tracking-[0.22em]" style={{ color: accent }}>
              {release.genre ?? 'Аудио'}
            </p>
            <h1 className="text-2xl font-black uppercase leading-none text-cf-text-heading">
              {release.title}
            </h1>
            {release.authors.length > 0 && (
              <p className="mt-2 text-sm text-cf-text-3">
                {release.authors.map(a => a.name).join(', ')}
              </p>
            )}
          </div>

          {/* Current track */}
          <div className="mb-6 text-center">
            {currentTrack ? (
              <>
                <p className="text-xs uppercase tracking-[0.14em] text-cf-text-4">
                  {currentIndex + 1} / {chapters.length}
                </p>
                <p className="mt-1 truncate text-base font-bold text-cf-text-1">
                  {currentTrack.title}
                </p>
                {currentArtist && (
                  <p className="mt-1 truncate text-sm text-cf-text-3">{currentArtist}</p>
                )}
                {currentAlbum && (
                  <p className="mt-0.5 truncate text-xs text-cf-text-4">{currentAlbum}</p>
                )}
                {trackError && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#d52525]">
                    Трек временно недоступен
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-cf-text-4">Треки не добавлены</p>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div
              ref={progressRef}
              className="relative h-1 w-full cursor-pointer rounded-full bg-cf-text-1/12"
              onClick={handleProgressClick}
              role="slider"
              aria-label="Прогресс воспроизведения"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{ width: `${progressPercent}%`, backgroundColor: accent }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full shadow"
                style={{
                  left: `${progressPercent}%`,
                  transform: `translate(-50%, -50%)`,
                  backgroundColor: accent,
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-cf-text-4">
              <span>{formatDuration(Math.floor(currentTime))}</span>
              <span>{duration > 0 ? formatDuration(Math.floor(duration)) : (currentTrack?.duration_seconds ? formatDuration(currentTrack.duration_seconds) : '--:--')}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 text-cf-text-3 hover:text-cf-text-1 transition-colors"
              aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-4">
              <button
                onClick={prevTrack}
                disabled={currentTime <= 3 && findPlayableTrack(currentIndex - 1, -1) < 0}
                className="p-2 text-cf-text-2 hover:text-cf-text-heading disabled:opacity-30 transition-colors"
                aria-label="Предыдущий трек"
              >
                <SkipBack className="h-6 w-6" />
              </button>

              <button
                onClick={togglePlay}
                disabled={!currentTrack?.audio_url}
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 disabled:opacity-40"
                style={{ backgroundColor: accent }}
                aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
              >
                {isLoading ? (
                  <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-6 w-6 text-white" />
                ) : (
                  <Play className="h-6 w-6 translate-x-0.5 text-white" />
                )}
              </button>

              <button
                onClick={nextTrack}
                disabled={findPlayableTrack(currentIndex + 1, 1) < 0}
                className="p-2 text-cf-text-2 hover:text-cf-text-heading disabled:opacity-30 transition-colors"
                aria-label="Следующий трек"
              >
                <SkipForward className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={e => { setVolume(Number(e.target.value)); setIsMuted(false) }}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-cf-text-1/12"
                aria-label="Громкость"
              />
            </div>
          </div>

          {/* Total duration */}
          {totalDuration > 0 && (
            <p className="mt-6 text-center text-xs text-cf-text-4">
              {chapters.length} {chapters.length === 1 ? 'трек' : 'треков'} · {formatTotalDuration(totalDuration)}
            </p>
          )}
        </div>
      </main>

      {/* Lyrics panel */}
      {showLyrics && currentLyrics && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setShowLyrics(false)} />
          <aside className="flex w-full max-w-xs flex-col border-l border-cf-text-1/10 bg-cf-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-cf-text-1/10 px-4 py-4">
              <div className="flex items-center gap-2">
                <Mic2 className="h-4 w-4" style={{ color: accent }} />
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-cf-text-heading">
                  {currentTrack?.title ?? 'Слова песни'}
                </h2>
              </div>
              <button
                onClick={() => setShowLyrics(false)}
                className="p-1 text-cf-text-3 hover:text-cf-text-1"
                aria-label="Закрыть слова"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              {currentLyrics.format === 'synced' ? (
                currentLyrics.lines.map((line, i) => {
                  const isActive = i === activeLyricLine
                  const isPast = i < activeLyricLine
                  return (
                    <button
                      key={i}
                      type="button"
                      ref={isActive ? lyricsLineRef : undefined}
                      onClick={() => handleLyricsLineClick(line.time!)}
                      className="block w-full text-left py-2 px-1 transition-all duration-300 rounded-sm"
                      style={{
                        color: isActive ? accent : undefined,
                        opacity: isActive ? 1 : isPast ? 0.35 : 0.5,
                        fontSize: isActive ? '1.1rem' : '0.85rem',
                        fontWeight: isActive ? 800 : 400,
                        lineHeight: isActive ? 1.6 : 1.4,
                        letterSpacing: isActive ? '0.02em' : undefined,
                      }}
                    >
                      {line.text}
                    </button>
                  )
                })
              ) : (
                currentLyrics.lines.map((line, i) => (
                  <p key={i} className="py-1 text-sm text-cf-text-2 leading-7">
                    {line.text}
                  </p>
                ))
              )}
            </div>
            {currentLyrics.format === 'synced' && activeLyricLine >= 0 && currentLyrics.lines[activeLyricLine]?.time !== undefined && (
              <div className="border-t border-cf-text-1/10 px-4 py-3 text-center">
                <span className="text-xs tabular-nums text-cf-text-4">
                  {formatDuration(Math.floor(currentLyrics.lines[activeLyricLine].time!))}
                </span>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Tracklist panel */}
      {showTracklist && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setShowTracklist(false)} />
          <aside className="flex w-full max-w-xs flex-col border-l border-cf-text-1/10 bg-cf-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-cf-text-1/10 px-4 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-cf-text-heading">
                {release.title}
              </h2>
              <button
                onClick={() => setShowTracklist(false)}
                className="p-1 text-cf-text-3 hover:text-cf-text-1"
                aria-label="Закрыть треклист"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => goToTrack(i)}
                  className={`flex w-full items-center gap-3 border-b border-cf-text-1/6 px-4 py-3 text-left transition-colors hover:bg-cf-text-1/4 ${
                    i === currentIndex ? 'bg-cf-text-1/6' : ''
                  }`}
                >
                  <span
                    className="min-w-[24px] text-xs tabular-nums font-black"
                    style={{ color: i === currentIndex ? accent : undefined }}
                  >
                    {i === currentIndex && isPlaying ? '▶' : String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${i === currentIndex ? 'text-cf-text-heading' : 'text-cf-text-2'}`}>
                      {ch.title}
                    </p>
                    {metadataString(ch, 'artist') && (
                      <p className="truncate text-xs text-cf-text-4">{metadataString(ch, 'artist')}</p>
                    )}
                    {ch.duration_seconds && (
                      <p className="text-xs text-cf-text-4">{formatDuration(ch.duration_seconds)}</p>
                    )}
                  </div>
                  {!ch.audio_url && (
                    <span className="text-[10px] uppercase tracking-wider text-cf-text-4">скоро</span>
                  )}
                  {extractLyrics(ch.audio_metadata) && (
                    <Mic2 className="h-3.5 w-3.5 text-cf-text-4" />
                  )}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
