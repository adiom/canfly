export const RELEASE_BLOCKS = ['characters', 'games', 'places', 'series', 'highlights'] as const
export type ReleaseBlock = typeof RELEASE_BLOCKS[number]
export const RELEASE_HERO_ART = ['none', 'svg', 'canvas'] as const
export type ReleaseHeroArtMode = typeof RELEASE_HERO_ART[number]

export const RELEASE_DESIGN_DEFAULTS = {
  accent_color: '#3d6e8c',
  bg_color: '#f4efe5',
  text_color: '#111210',
  hero_style: 'full',
  hero_overlay: 'none',
  hero_art: 'none',
  layout: 'wide',
} as const

export const RELEASE_BLOCK_LABELS: Record<ReleaseBlock, string> = {
  characters: 'Персонажи',
  games: 'Игры',
  places: 'Места',
  series: 'Серия',
  highlights: 'Работы читателей',
}

export function releaseBlockOrder(saved?: readonly ReleaseBlock[]): ReleaseBlock[] {
  const known = saved?.filter(block => RELEASE_BLOCKS.includes(block)) ?? []
  return [...new Set([...known, ...RELEASE_BLOCKS])]
}
