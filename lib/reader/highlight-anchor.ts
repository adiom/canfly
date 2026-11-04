import { resolveAnchor } from '@/lib/highlights/anchor'
import type { TextAnchor } from '@/lib/highlights/types'
import { collectParagraphs } from './highlights-dom'

type Point = { node: Text; offset: number }
const block = /^(P|DIV|BR|LI|BLOCKQUOTE|H[1-6]|TR|PRE|HR)$/
export function indexReaderText(root: HTMLElement) {
  let text = ''
  const points: (Point | null)[] = []
  const space = () => { if (text && !text.endsWith(' ')) { text += ' '; points.push(null) } }
  const visit = (node: Node) => {
    if (node instanceof Text) {
      const value = node.data
      for (let offset = 0; offset < value.length; offset++) {
        if (/\s/u.test(value[offset])) space()
        else { text += value[offset]; points.push({ node, offset }) }
      }
    } else if (node instanceof HTMLElement) {
      if (['SCRIPT', 'STYLE'].includes(node.tagName)) return
      if (block.test(node.tagName)) space()
      node.childNodes.forEach(visit)
      if (block.test(node.tagName)) space()
    }
  }
  root.childNodes.forEach(visit)
  if (text.endsWith(' ')) { text = text.slice(0, -1); points.pop() }
  return { text, points }
}
export function readerRange(root: HTMLElement, anchor: Pick<TextAnchor, 'start' | 'end' | 'exact' | 'prefix' | 'suffix'>, indexed = indexReaderText(root)): Range | null {
  const found = resolveAnchor(indexed.text, anchor)
  if (!found) return null
  const from = indexed.points[found.start]
  const to = indexed.points[found.end - 1]
  if (!from || !to) return null
  const range = document.createRange()
  range.setStart(from.node, from.offset); range.setEnd(to.node, to.offset + 1)
  return range
}
export async function captureReaderSelection(root: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0).cloneRange()
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const { text, points } = indexReaderText(root)
  const included = points.flatMap((point, index) => point && range.comparePoint(point.node, point.offset) === 0 &&
    range.comparePoint(point.node, point.offset + 1) === 0 ? [index] : [])
  if (!included.length) return null
  const start = included[0], end = included[included.length - 1] + 1
  const exact = text.slice(start, end)
  if (exact.length < 3) return null
  const rect = range.getBoundingClientRect()
  const paragraph = (range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement)?.closest('p,blockquote,h1,h2,h3,h4,li')
  const paragraphIndex = paragraph ? collectParagraphs(root).indexOf(paragraph as HTMLElement) : 0
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const revision = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  const anchor: TextAnchor = { version: 2, start, end, exact, prefix: text.slice(Math.max(0, start - 80), start), suffix: text.slice(end, end + 80), revision }
  return { text: exact, rect, paragraphIndex: Math.max(0, paragraphIndex), contextBefore: anchor.prefix,
    contextAfter: anchor.suffix, startOffset: start, endOffset: end, anchor }
}
