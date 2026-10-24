import { collectParagraphs } from '@/lib/reader/highlights-dom'

export interface ReadingPosition {
  paragraphIndex: number
  offset: number
}

function textNodes(element: HTMLElement): Text[] {
  const result: Text[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    result.push(node as Text)
    node = walker.nextNode()
  }
  return result
}

function characterPage(node: Text, offset: number, origin: number, step: number): number {
  if (node.length === 0) return 0
  const range = document.createRange()
  const start = Math.min(offset, node.length - 1)
  range.setStart(node, start)
  range.setEnd(node, start + 1)
  const rect = range.getClientRects()[0]
  return rect ? Math.max(0, Math.floor((rect.left - origin + 1) / step)) : 0
}

/** First text character on the left visible page, independent of viewport size. */
export function captureReadingPosition(root: HTMLElement, track: HTMLElement, page: number, step: number): ReadingPosition {
  const paragraphs = collectParagraphs(root)
  const origin = track.getBoundingClientRect().left
  for (let index = 0; index < paragraphs.length; index++) {
    let offset = 0
    for (const node of textNodes(paragraphs[index])) {
      if (node.length && characterPage(node, node.length - 1, origin, step) >= page) {
        let low = 0
        let high = node.length - 1
        while (low < high) {
          const mid = Math.floor((low + high) / 2)
          if (characterPage(node, mid, origin, step) < page) low = mid + 1
          else high = mid
        }
        return { paragraphIndex: index, offset: offset + low }
      }
      offset += node.length
    }
  }
  return { paragraphIndex: Math.max(0, paragraphs.length - 1), offset: 0 }
}

export function pageForReadingPosition(root: HTMLElement, track: HTMLElement, position: ReadingPosition, step: number): number {
  const paragraphs = collectParagraphs(root)
  const paragraph = paragraphs[Math.min(position.paragraphIndex, paragraphs.length - 1)]
  if (!paragraph) return 0
  const nodes = textNodes(paragraph)
  let offset = position.offset
  const origin = track.getBoundingClientRect().left
  for (const node of nodes) {
    if (offset < node.length) return characterPage(node, offset, origin, step)
    offset -= node.length
  }
  const last = nodes[nodes.length - 1]
  return last ? characterPage(last, last.length - 1, origin, step) : 0
}
