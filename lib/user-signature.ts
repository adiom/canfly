import { CANFLY_COLORS, type CanflyColor } from '@/lib/canfly-colors'

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** Тёмный ли фон — по фактической яркости, чтобы подобрать читаемый цвет текста поверх. */
export function isDarkHex(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16)
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  return luminance < 0.42
}

/**
 * Цвет-паспорт читателя. Явный выбор пользователя — приоритет; иначе
 * детерминированный кадр из users.id, чтобы профиль был осмысленным
 * сразу после регистрации и не менялся между рендерами.
 */
export function signatureColorFor(user: {
  id: string
  signature_color?: string | null
}): CanflyColor {
  const chosen = user.signature_color
    ? CANFLY_COLORS.find((color) => color.id === user.signature_color)
    : null
  if (chosen) return chosen

  let hash = 0
  for (let i = 0; i < user.id.length; i += 1) {
    hash = (hash * 31 + user.id.charCodeAt(i)) >>> 0
  }
  return CANFLY_COLORS[hash % CANFLY_COLORS.length]
}

export interface SignatureTheme {
  color: CanflyColor
  /** Читаемый текст поверх полосы */
  ink: string
  inkSoft: string
}

export function signatureTheme(user: { id: string; signature_color?: string | null }): SignatureTheme {
  const color = signatureColorFor(user)
  const dark = isDarkHex(color.hex)
  return {
    color,
    ink: dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.74)',
    inkSoft: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
  }
}
