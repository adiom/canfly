import { OG_SIZE, OG_CONTENT_TYPE, ogResponse, ogFallback } from '@/lib/seo/og-shared'

export const alt = 'canfly | культура твоего сознания'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * Баннер по умолчанию: он же подставляется страницам без своего генератора
 * (см. `DEFAULT_OG_IMAGE` в `lib/seo/metadata.ts`).
 */
export default async function Image() {
  try {
    return await ogResponse({
      kicker: 'canfly',
      title: 'культура твоего сознания',
      note: 'комиксы · книги · аудиокниги · журналы',
    })
  } catch {
    return ogFallback()
  }
}
