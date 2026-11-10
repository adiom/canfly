import type { V2EdgeKind, V2NodeKind } from '@/lib/server/v2'

export const GRAPH_WIDTH = 1000
export const GRAPH_HEIGHT = 620
export const LABEL_FLIP_RATIO = 0.5

interface Position {
  x: number
  y: number
}

const NODE_POSITIONS: Record<string, Position> = {
  'release:kroy-po-dushe': { x: 240, y: 185 },
  'character:sonya': { x: 435, y: 105 },
  'series:kroy-po-dushe': { x: 115, y: 360 },
  'release:esche-odna-popytka-soni': { x: 345, y: 378 },
  'character:Maria': { x: 210, y: 530 },
  'character:Varvara': { x: 755, y: 155 },
  'release:neuchtyonnaya-tom-1': { x: 805, y: 370 },
  'character:Mira': { x: 545, y: 512 },
  'release:bplr': { x: 705, y: 548 },
  'place:N': { x: 520, y: 288 },
}

/* На узком экране подписи разведены по высоте, связи остаются теми же. */
const MOBILE_POSITIONS: Record<string, Position> = {
  'release:kroy-po-dushe': { x: 130, y: 124 },
  'character:sonya': { x: 460, y: 62 },
  'character:Varvara': { x: 850, y: 143 },
  'place:N': { x: 560, y: 229 },
  'series:kroy-po-dushe': { x: 120, y: 322 },
  'release:esche-odna-popytka-soni': { x: 500, y: 384 },
  'release:neuchtyonnaya-tom-1': { x: 860, y: 322 },
  'character:Maria': { x: 180, y: 471 },
  'character:Mira': { x: 820, y: 490 },
  'release:bplr': { x: 550, y: 546 },
}

export const GRAPH_KIND_LABELS: Record<V2NodeKind, string> = {
  release: 'релиз',
  character: 'персонаж',
  series: 'серия',
  place: 'место',
}

export const GRAPH_EDGE_LABELS: Record<V2EdgeKind, string> = {
  cast: 'в релизе',
  series: 'серия',
  relation: 'связь',
  place: 'место',
  location: 'событие',
}

export function graphPosition(id: string, mobile = false): Position {
  const known = mobile ? MOBILE_POSITIONS[id] : NODE_POSITIONS[id]
  if (known) return known
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const angle = ((hash % 360) * Math.PI) / 180
  return {
    x: GRAPH_WIDTH / 2 + Math.cos(angle) * 330,
    y: GRAPH_HEIGHT / 2 + Math.sin(angle) * 235,
  }
}
