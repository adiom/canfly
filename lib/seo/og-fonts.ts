import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Шрифты для `ImageResponse` (satori).
 *
 * Satori не умеет брать шрифты из `next/font/google` и без явного `fonts`
 * рендерит кириллицу квадратами — поэтому начертания лежат локально в
 * `assets/og/` (вне `public/`, чтобы не отдаваться статикой) и читаются с диска.
 * Отсюда же следует, что OG-роуты обязаны работать на Node runtime: на edge
 * `node:fs` недоступен.
 */

const FONT_DIR = join(process.cwd(), 'assets/og')

export const OG_FONT_SANS = 'Libre Franklin'
export const OG_FONT_SERIF = 'Cormorant Garamond'

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal' | 'italic'
}

// Модульный кэш: на одном инстансе файлы читаются один раз, а не на каждый
// запрос картинки.
let fontsPromise: Promise<OgFont[]> | null = null

async function loadFonts(): Promise<OgFont[]> {
  const [sans, serif] = await Promise.all([
    readFile(join(FONT_DIR, 'LibreFranklin-Bold.ttf')),
    readFile(join(FONT_DIR, 'CormorantGaramond-Italic.ttf')),
  ])

  return [

    {
      name: OG_FONT_SANS,
      data: sans.buffer.slice(sans.byteOffset, sans.byteOffset + sans.byteLength) as ArrayBuffer,
      weight: 700,
      style: 'normal',
    },
    {
      name: OG_FONT_SERIF,
      data: serif.buffer.slice(serif.byteOffset, serif.byteOffset + serif.byteLength) as ArrayBuffer,
      weight: 400,
      style: 'italic',
    },
  ]
}

export function ogFonts(): Promise<OgFont[]> {
  // Кэшируется только успешная загрузка: иначе одна неудачная попытка
  // (например, холодный старт до распаковки бандла) навсегда оставила бы
  // инстанс без шрифтов.
  fontsPromise ??= loadFonts().catch(error => {
    fontsPromise = null
    throw error
  })
  return fontsPromise
}
