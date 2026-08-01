import type { ChapterHighlight, ChapterEditorialNote } from '@/lib/releases-types'

export const PARAGRAPH_TAGS = ['p', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'li']

/** Собирает параграфы из DOM-дерева root через TreeWalker. */
export function collectParagraphs(root: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_REJECT
      if (PARAGRAPH_TAGS.includes(node.tagName.toLowerCase())) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_SKIP
    },
  })
  let node: Node | null = walker.nextNode()
  while (node) {
    result.push(node as HTMLElement)
    node = walker.nextNode()
  }
  return result
}

/** Возвращает индекс параграфа для элемента (по DOM-порядку). */
export function paragraphIndexOf(paragraphs: HTMLElement[], el: HTMLElement): number {
  return paragraphs.indexOf(el)
}

/**
 * Ищет Range для text внутри paragraph.
 * Fallback к контекстному поиску (context_before + префикс text).
 */
export function findTextRange(
  paragraph: HTMLElement,
  text: string,
  contextBefore?: string | null,
  startOffset?: number | null,
  endOffset?: number | null,
): Range | null {
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let fullText = ''
  let n: Node | null = walker.nextNode()
  while (n) {
    const node = n as Text
    if (node.parentElement?.closest('mark[data-cf-hl], mark[data-cf-en]')) {
      n = walker.nextNode()
      continue
    }
    textNodes.push(node)
    fullText += node.textContent ?? ''
    n = walker.nextNode()
  }

  let start = -1
  let end = -1
  if (startOffset != null && endOffset != null && fullText.slice(startOffset, endOffset) === text) {
    start = startOffset
    end = endOffset
  } else if (contextBefore) {
    const needle = contextBefore + text
    const contextual = fullText.indexOf(needle)
    if (contextual >= 0) start = contextual + contextBefore.length
  }
  if (start < 0) start = fullText.indexOf(text)
  if (start < 0) return null
  if (end < 0) end = start + text.length

  const locate = (offset: number, isEnd: boolean) => {
    let cursor = 0
    for (const node of textNodes) {
      const length = node.textContent?.length ?? 0
      if (offset < cursor + length || (isEnd && offset === cursor + length)) {
        return { node, offset: offset - cursor }
      }
      cursor += length
    }
    return null
  }
  const from = locate(start, false)
  const to = locate(end, true)
  if (!from || !to) return null
  const range = document.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  return range
}

/** Применяет стили и hover-эффекты к <mark>. */
export function styleMark(mark: HTMLElement, color: string, idleOpacity: string) {
  mark.style.cursor = 'pointer'
  mark.style.borderRadius = '2px'
  mark.style.padding = '0 1px'
  mark.style.transition = 'background-color 0.15s'
  const idle = `${color}${idleOpacity}`
  mark.style.backgroundColor = idle
  mark.addEventListener('mouseenter', () => { mark.style.backgroundColor = `${color}88` })
  mark.addEventListener('mouseleave', () => { mark.style.backgroundColor = idle })
}

function applyMark(range: Range, mark: HTMLElement) {
  const contents = range.extractContents()
  mark.appendChild(contents)
  range.insertNode(mark)
}

/** Обёртывает highlight в <mark data-cf-hl> внутри paragraph. */
export function wrapHighlight(
  paragraph: HTMLElement,
  hl: ChapterHighlight,
  currentUserId: string | null,
  accent: string,
) {
  const text = hl.text_content
  if (!text) return
  const range = findTextRange(paragraph, text, hl.context_before, hl.start_offset, hl.end_offset)
  if (!range) return
  try {
    const mark = document.createElement('mark')
    mark.dataset.cfHl = hl.id
    mark.dataset.cfMine = hl.user_id === currentUserId && !hl.is_public ? 'true' : ''
    styleMark(mark, accent, '44')
    applyMark(range, mark)
  } catch {
    // skip on cross-node selections
  }
}

/** Обёртывает editorial note в <mark data-cf-en> внутри paragraph. */
export function wrapEditorialNote(paragraph: HTMLElement, en: ChapterEditorialNote) {
  const text = en.text_content
  if (!text) return
  const range = findTextRange(paragraph, text, en.context_before, en.start_offset, en.end_offset)
  if (!range) return
  try {
    const mark = document.createElement('mark')
    mark.dataset.cfEn = en.id
    const statusColor = en.status === 'open' ? '#e97316' : en.status === 'resolved' ? '#16a34a' : '#6b7280'
    const bgOpacity = en.status === 'open' ? '44' : en.status === 'resolved' ? '28' : '18'
    styleMark(mark, statusColor, bgOpacity)
    applyMark(range, mark)
  } catch {
    // skip
  }
}

/** Снимает все highlight/editorial-note обёртки с root. */
export function clearHighlightMarks(root: HTMLElement) {
  root.querySelectorAll('mark[data-cf-hl], mark[data-cf-en]').forEach(el => {
    const parent = el.parentNode
    if (!parent) return
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
    parent.normalize()
  })
}

/**
 * Определяет номер страницы (0-indexed) для DOM-элемента
 * внутри CSS multi-column контейнера.
 */
export function pageOfElement(
  el: HTMLElement,
  trackEl: HTMLElement,
  pageWidth: number,
  gutter: number,
  isSpread: boolean,
): number {
  const trackRect = trackEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  // Учитываем текущий transform (translateX) трека
  const matrix = new DOMMatrix(getComputedStyle(trackEl).transform)
  const transformX = matrix.m41
  const elLeft = elRect.left - trackRect.left - transformX
  const colStep = pageWidth + gutter
  const page = Math.max(0, Math.floor(elLeft / colStep))
  if (isSpread && page % 2 !== 0) return Math.max(0, page - 1)
  return page
}
