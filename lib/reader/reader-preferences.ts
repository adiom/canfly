'use client'

import { useEffect, useState } from 'react'
import { CANFLY_COLORS } from '@/lib/canfly-colors'

// ─── Темы ────────────────────────────────────────────────────────────────────

export type ReaderThemeId = 'void' | 'manuscript' | 'sepia'

export interface ReaderThemeDef {
  id: ReaderThemeId
  label: string
  fullName: string
  bg: string
  bg2: string
  text: string
  text2: string
  shadow: string
  spineLine: string
  pageInner: string
  pageOuter: string
}

const VOID = CANFLY_COLORS.find(c => c.id === 'CF-004')
const MANUSCRIPT = CANFLY_COLORS.find(c => c.id === 'CF-003')

export const READER_THEMES: Record<ReaderThemeId, ReaderThemeDef> = {
  void: {
    id: 'void',
    label: 'Void',
    fullName: VOID?.fullName ?? 'before the first photon',
    bg: VOID?.hex ?? '#111210',
    bg2: '#1b1c19',
    text: '#f4efe5',
    text2: '#cec8bb',
    shadow: 'rgba(0,0,0,0.6)',
    spineLine: 'rgba(255, 235, 200, 0.08)',
    pageInner: 'rgba(255, 235, 200, 0.04)',
    pageOuter: 'rgba(0, 0, 0, 0.55)',
  },
  manuscript: {
    id: 'manuscript',
    label: 'Manuscript',
    fullName: MANUSCRIPT?.fullName ?? 'burned papyrus',
    bg: MANUSCRIPT?.hex ?? '#f4efe5',
    bg2: '#ebe5d9',
    text: '#1a1816',
    text2: '#3d3830',
    shadow: 'rgba(60, 40, 20, 0.18)',
    spineLine: 'rgba(60, 40, 20, 0.18)',
    pageInner: 'rgba(60, 40, 20, 0.05)',
    pageOuter: 'rgba(60, 40, 20, 0.10)',
  },
  sepia: {
    id: 'sepia',
    label: 'Sepia',
    fullName: 'warm parchment',
    bg: '#2a2318',
    bg2: '#312a1e',
    text: '#e8d9bb',
    text2: '#c8b894',
    shadow: 'rgba(0, 0, 0, 0.5)',
    spineLine: 'rgba(232, 217, 187, 0.10)',
    pageInner: 'rgba(232, 217, 187, 0.05)',
    pageOuter: 'rgba(0, 0, 0, 0.45)',
  },
}

/** Устаревшие значения из старых версий читалки → актуальные темы. */
export const READER_LEGACY_THEME_MAP: Record<string, ReaderThemeId> = {
  dark: 'void',
  light: 'manuscript',
  sepia: 'sepia',
}

// ─── Шрифты ──────────────────────────────────────────────────────────────────

export type ReaderFontId = 'serif' | 'display' | 'sans' | 'mono' | 'dyslexic'

export interface ReaderFontDef {
  id: ReaderFontId
  label: string
  family: string
  sample: string
}

export const READER_FONTS: ReaderFontDef[] = [
  { id: 'serif',    label: 'Cormorant',        family: 'var(--font-cormorant), Georgia, serif',        sample: 'Литературная классика' },
  { id: 'display',  label: 'EB Garamond',      family: 'var(--font-ebgaramond), Georgia, serif',        sample: 'Книжная антиква' },
  { id: 'sans',     label: 'Geist',            family: 'var(--font-geist-sans), system-ui, sans-serif', sample: 'Нейтральный современный' },
  { id: 'mono',     label: 'Geist Mono',       family: 'var(--font-geist-mono), ui-monospace, monospace', sample: 'Терминал · код' },
  { id: 'dyslexic', label: 'Libre Franklin',   family: 'var(--font-libre-franklin), system-ui, sans-serif', sample: 'Доступный для всех' },
]

export const READER_FONT_STACK: Record<ReaderFontId, string> = READER_FONTS.reduce(
  (acc, f) => ({ ...acc, [f.id]: f.family }),
  {} as Record<ReaderFontId, string>,
)

// ─── Дефолты и границы ──────────────────────────────────────────────────────

export const READER_THEME_DEFAULT: ReaderThemeId = 'void'
export const READER_FONT_DEFAULT: ReaderFontId = 'serif'
export const READER_FONT_SIZE_DEFAULT = 18
export const READER_FONT_SIZE_MIN = 14
export const READER_FONT_SIZE_MAX = 26

export const READER_STORAGE_KEYS = {
  theme: 'canfly-reader-theme',
  font: 'canfly-reader-font',
  fontSize: 'canfly-reader-fontsize',
} as const

// ─── Хук: настройки чтения ──────────────────────────────────────────────────

export function useReaderPreferences() {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<ReaderThemeId>(READER_THEME_DEFAULT)
  const [font, setFont] = useState<ReaderFontId>(READER_FONT_DEFAULT)
  const [fontSize, setFontSize] = useState(READER_FONT_SIZE_DEFAULT)

  useEffect(() => {
    const raw = window.localStorage.getItem(READER_STORAGE_KEYS.theme)
    if (raw && raw in READER_THEMES) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration gate pattern
      setTheme(raw as ReaderThemeId)
    } else if (raw && raw in READER_LEGACY_THEME_MAP) {
      const migrated = READER_LEGACY_THEME_MAP[raw]
      setTheme(migrated)
      window.localStorage.setItem(READER_STORAGE_KEYS.theme, migrated)
    }
    const fRaw = window.localStorage.getItem(READER_STORAGE_KEYS.font)
    if (fRaw && fRaw in READER_FONT_STACK) {
      setFont(fRaw as ReaderFontId)
    }
    const fsRaw = window.localStorage.getItem(READER_STORAGE_KEYS.fontSize)
    if (fsRaw) {
      const n = parseInt(fsRaw, 10)
      if (n >= READER_FONT_SIZE_MIN && n <= READER_FONT_SIZE_MAX) {
        setFontSize(n)
      }
    }
    setMounted(true)
  }, [])

  const applyTheme = (next: ReaderThemeId) => {
    setTheme(next)
    window.localStorage.setItem(READER_STORAGE_KEYS.theme, next)
  }
  const applyFont = (next: ReaderFontId) => {
    setFont(next)
    window.localStorage.setItem(READER_STORAGE_KEYS.font, next)
  }
  const applyFontSize = (f: number) => {
    setFontSize(f)
    window.localStorage.setItem(READER_STORAGE_KEYS.fontSize, String(f))
  }

  return {
    mounted,
    theme,
    font,
    fontSize,
    t: READER_THEMES[theme],
    fontFamily: READER_FONT_STACK[font],
    applyTheme,
    applyFont,
    applyFontSize,
  }
}