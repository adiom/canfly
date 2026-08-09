import { ImageResponse } from 'next/og'
import { ogFonts, OG_FONT_SANS, OG_FONT_SERIF } from './og-fonts'

/**
 * Общий каркас OG-картинок. Здесь цвета заданы литералами, а не токенами
 * `cf-*`: satori рендерит вне документа, CSS-переменные ему недоступны.
 * Значения — тёмная тема из `app/globals.css`.
 */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const C = {
  bg: '#111210',
  surface: '#1b1c19',
  text1: '#f4efe5',
  text2: '#ded7cc',
  accent: '#d52525',
} as const

export const OG_COLORS = C

const WORDMARK = 'canfly'
const TAGLINE = 'культура твоего сознания'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: C.bg,
        color: C.text1,
        fontFamily: OG_FONT_SANS,
        padding: '64px 72px',
      }}
    >
      <div style={{ display: 'flex', height: 6, width: 140, backgroundColor: C.accent }} />
      {children}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 24,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: C.text2,
        }}
      >
        <span>{WORDMARK}</span>
        <span style={{ fontSize: 20, opacity: 0.7 }}>{TAGLINE}</span>
      </div>
    </div>
  )
}

/** Заголовок с автоподбором кегля: длинные названия не должны вылезать за кадр. */
export function OgTitle({
  text,
  max = 68,
  serif = false,
}: {
  text: string
  max?: number
  serif?: boolean
}) {
  const size = text.length > 60 ? max - 20 : text.length > 34 ? max - 10 : max
  return (
    <div
      style={{
        display: 'flex',
        fontSize: size,
        lineHeight: serif ? 1.25 : 1.1,
        letterSpacing: '-0.01em',
        // Цитату не капитализируем: капслок ломает чтение длинного текста.
        ...(serif
          ? { fontFamily: OG_FONT_SERIF, fontStyle: 'italic' }
          : { textTransform: 'uppercase' }),
      }}
    >
      {text}
    </div>
  )
}

export function OgKicker({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        fontSize: 22,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: C.accent,
      }}
    >
      {text}
    </div>
  )
}

export function OgNote({ text, serif = false }: { text: string; serif?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        fontSize: serif ? 34 : 26,
        lineHeight: 1.4,
        color: C.text2,
        ...(serif && { fontFamily: OG_FONT_SERIF, fontStyle: 'italic' }),
      }}
    >
      {text}
    </div>
  )
}

export interface OgLayoutOptions {
  kicker?: string | null
  title: string
  titleSerif?: boolean
  note?: string | null
  serifNote?: boolean
  image?: string | null
  imageRounded?: boolean
}

/** Левая колонка — текст, справа опционально обложка или аватар. */
export function ogLayout(opts: OgLayoutOptions) {
  const { kicker, title, titleSerif, note, serifNote, image, imageRounded } = opts

  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 56, flexGrow: 1 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            flexGrow: 1,
            maxWidth: image ? 660 : '100%',
          }}
        >
          {kicker ? <OgKicker text={kicker} /> : null}
          <OgTitle text={title} serif={titleSerif} max={titleSerif ? 56 : 68} />
          {note ? <OgNote text={note} serif={serifNote} /> : null}
        </div>
        {image ? (
          <img
            src={image}
            width={300}
            height={imageRounded ? 300 : 420}
            style={{
              objectFit: 'cover',
              backgroundColor: C.surface,
              ...(imageRounded && { borderRadius: 150 }),
            }}
          />
        ) : null}
      </div>
    </Frame>
  )
}

/** Обрезка по границе слова — чтобы подпись не рвалась посередине. */
export function ogClamp(text: string | null | undefined, max: number): string | null {
  if (!text) return null
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean || null
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export async function ogResponse(opts: OgLayoutOptions) {
  return new ImageResponse(ogLayout(opts), {
    ...OG_SIZE,
    fonts: await ogFonts(),
  })
}

/**
 * Фолбэк на случай «сущность не найдена» или упавшего запроса: unfurl в
 * мессенджере не должен получать 500 вместо картинки.
 */
export async function ogFallback() {
  return ogResponse({ title: WORDMARK, note: TAGLINE })
}
