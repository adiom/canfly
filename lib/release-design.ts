export const RELEASE_BLOCKS = ['characters', 'games', 'places', 'series', 'highlights'] as const
export type ReleaseBlock = typeof RELEASE_BLOCKS[number]

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
