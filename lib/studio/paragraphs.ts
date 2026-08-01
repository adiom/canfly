/**
 * Сбор «параграфов» редактора для позиционирования редакторских правок.
 *
 * Индекс параграфа считается ТОЛЬКО внутри корня редактора (`.ProseMirror`),
 * иначе `paragraph_index` из панели и из оверлея расходятся: панель считала бы
 * по всему документу вместе с боковой панелью и хедером.
 */

/** Теги, которые считаются отдельным «параграфом». */
export const PARAGRAPH_TAGS = ['p', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'li'] as const

const TAG_SET = new Set<string>(PARAGRAPH_TAGS)

export function isParagraphElement(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && TAG_SET.has(node.tagName.toLowerCase())
}

/** Все параграфы внутри корня — в порядке обхода документа. */
export function collectParagraphs(root: Element): HTMLElement[] {
  const paragraphs: HTMLElement[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: node =>
      isParagraphElement(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  })
  let n: Node | null = walker.nextNode()
  while (n) {
    paragraphs.push(n as HTMLElement)
    n = walker.nextNode()
  }
  return paragraphs
}

/** Ближайший предок-параграф; `null`, если узел вне параграфа. */
export function closestParagraph(node: Node | null, boundary: Node): HTMLElement | null {
  let current: Node | null = node
  while (current && current !== boundary) {
    if (isParagraphElement(current)) return current
    current = current.parentNode
  }
  return null
}
