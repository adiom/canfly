import type { Chapter, EditionFormat, Release } from '@/lib/releases-types'
import { EDITION_FORMAT_LABELS } from '@/lib/utils/editions'
import { buildDocx, type DocxBlock, type DocxRun, type DocxTableRow } from '@/lib/server/docx'

/**
 * Экспорт издания в `.docx` для скачивания как документ Word.
 *
 * HTML главы приходит уже очищенным `sanitizeChapterHtml`, поэтому разбираем его
 * своим небольшим парсером: набор тегов ограничен редактором (заголовки, абзацы,
 * списки, цитаты, код, ссылки, таблицы), а внешние парсеры HTML тянут за собой
 * лишние зависимости.
 */

interface HtmlNode {
  tag: string
  attrs: Record<string, string>
  children: HtmlChild[]
}

type HtmlChild = HtmlNode | string

const VOID_TAGS = new Set(['br', 'hr', 'img', 'wbr', 'col', 'source'])
const INLINE_TAGS = new Set([
  'span', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'code', 'sub', 'sup', 'mark', 'small', 'abbr',
])
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const TAG_CHUNK = /<[^>]*>|[^<]+/g
const CLOSE_TAG = /^<\s*\/\s*([a-zA-Z][a-zA-Z0-9:-]*)\s*>$/
const OPEN_TAG = /^<\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*?)(\/?)>$/
const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/g
const WHITESPACE = /[ \t\r\n\f\v]+/g
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  hellip: '…',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of source.matchAll(ATTRIBUTE)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

/**
 * Разбор HTML в дерево. Незакрытые и лишние теги не считаем ошибкой: чистильщик
 * уже отработал, а «битым» фрагментам достаточно не ломать текст.
 */
function parseHtml(html: string): HtmlChild[] {
  const root: HtmlNode = { tag: '#root', attrs: {}, children: [] }
  const stack: HtmlNode[] = [root]

  for (const chunk of html.replace(/<!--[\s\S]*?-->/g, '').match(TAG_CHUNK) ?? []) {
    if (!chunk.startsWith('<')) {
      stack[stack.length - 1].children.push(chunk)
      continue
    }
    if (chunk.startsWith('<!') || chunk.startsWith('<?')) continue

    const close = chunk.match(CLOSE_TAG)
    if (close) {
      const tag = close[1].toLowerCase()
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.length = index
          break
        }
      }
      continue
    }

    const open = chunk.match(OPEN_TAG)
    if (!open) continue
    const tag = open[1].toLowerCase()
    const node: HtmlNode = { tag, attrs: parseAttributes(open[2]), children: [] }
    stack[stack.length - 1].children.push(node)
    if (!open[3] && !VOID_TAGS.has(tag)) stack.push(node)
  }

  return root.children
}

interface Marks {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  href?: string
}

function marksFor(marks: Marks, tag: string, attrs: Record<string, string>): Marks {
  switch (tag) {
    case 'strong':
    case 'b':
      return { ...marks, bold: true }
    case 'em':
    case 'i':
      return { ...marks, italic: true }
    case 'u':
      return { ...marks, underline: true }
    case 's':
    case 'del':
    case 'strike':
      return { ...marks, strike: true }
    case 'code':
      return { ...marks, code: true }
    case 'a':
      return attrs.href ? { ...marks, href: attrs.href } : marks
    default:
      return marks
  }
}

function sameMarks(left: DocxRun, right: DocxRun): boolean {
  return (
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    Boolean(left.strike) === Boolean(right.strike) &&
    Boolean(left.code) === Boolean(right.code) &&
    (left.href ?? '') === (right.href ?? '')
  )
}

/** Склеивает соседние runs с одинаковой разметкой и снимает пробелы по краям. */
function normalizeRuns(runs: DocxRun[]): DocxRun[] {
  const merged: DocxRun[] = []
  for (const run of runs) {
    if (!run.text) continue
    const previous = merged[merged.length - 1]
    if (previous && sameMarks(previous, run)) {
      previous.text += run.text
      continue
    }
    merged.push({ ...run })
  }

  const first = merged[0]
  if (first) first.text = first.text.replace(/^[ \t\r\n\u00a0]+/, '')
  const last = merged[merged.length - 1]
  if (last) last.text = last.text.replace(/[ \t\r\n\u00a0]+$/, '')

  return merged.filter((run) => run.text.length > 0)
}

function brNode(): HtmlNode {
  return { tag: 'br', attrs: {}, children: [] }
}

function inlineRuns(children: HtmlChild[], marks: Marks): DocxRun[] {
  const runs: DocxRun[] = []

  for (const child of children) {
    if (typeof child === 'string') {
      const text = decodeEntities(child).replace(WHITESPACE, ' ')
      if (text) runs.push({ text, ...marks })
      continue
    }

    if (child.tag === 'br') {
      runs.push({ text: '\n', ...marks })
      continue
    }

    if (child.tag === 'hr' || child.tag === 'ul' || child.tag === 'ol' || child.tag === 'table') continue

    if (child.tag === 'img') {
      const alt = (child.attrs.alt ?? '').trim()
      if (alt) runs.push({ text: alt, ...marks, italic: true })
      continue
    }

    runs.push(...inlineRuns(child.children, marksFor(marks, child.tag, child.attrs)))
  }

  return runs
}

function preText(node: HtmlNode): string {
  return node.children
    .map((child) => {
      if (typeof child === 'string') return decodeEntities(child)
      if (child.tag === 'br') return '\n'
      return preText(child)
    })
    .join('')
}

/** Прямые потомки `<li>` без вложенных списков: абзацы разворачиваем в текст пункта. */
function listItemInlines(item: HtmlNode): HtmlChild[] {
  const inlines: HtmlChild[] = []
  for (const child of item.children) {
    if (typeof child === 'string') {
      inlines.push(child)
      continue
    }
    if (child.tag === 'ul' || child.tag === 'ol' || child.tag === 'pre' || child.tag === 'table') continue
    if (child.tag === 'p' || child.tag === 'div') {
      if (inlines.length) inlines.push(brNode())
      inlines.push(...child.children)
      continue
    }
    inlines.push(child)
  }
  return inlines
}

function listRows(node: HtmlNode): HtmlNode[] {
  const rows: HtmlNode[] = []
  for (const child of node.children) {
    if (typeof child === 'string') continue
    if (child.tag === 'tr') rows.push(child)
    else if (child.tag === 'thead' || child.tag === 'tbody' || child.tag === 'tfoot') rows.push(...listRows(child))
  }
  return rows
}

function tableBlock(node: HtmlNode): DocxBlock | null {
  const rows: DocxTableRow[] = []
  for (const row of listRows(node)) {
    const cells = row.children.filter((child): child is HtmlNode => typeof child !== 'string')
      .filter((cell) => cell.tag === 'th' || cell.tag === 'td')
    if (!cells.length) continue
    rows.push({
      header: cells.every((cell) => cell.tag === 'th'),
      cells: cells.map((cell) => normalizeRuns(inlineRuns(cell.children, {}))),
    })
  }
  const filled = rows.filter((row) => row.cells.some((cell) => cell.length > 0))
  return filled.length ? { type: 'table', rows: filled } : null
}

interface BlockContext {
  quote: boolean
  list?: { ordered: boolean; level: number }
}

function textBlock(runs: DocxRun[], context: BlockContext): DocxBlock {
  if (context.quote) return { type: 'paragraph', runs, quote: true }
  if (context.list) return { type: 'listItem', runs, ordered: context.list.ordered, level: context.list.level }
  return { type: 'paragraph', runs }
}

function renderList(node: HtmlNode, context: BlockContext, ordered: boolean): DocxBlock[] {
  const level = context.list ? context.list.level + 1 : 0
  const blocks: DocxBlock[] = []

  for (const child of node.children) {
    if (typeof child === 'string') continue
    if (child.tag !== 'li') {
      blocks.push(...renderBlocks([child], context))
      continue
    }

    const runs = normalizeRuns(inlineRuns(listItemInlines(child), {}))
    if (runs.length) blocks.push({ type: 'listItem', runs, ordered, level })

    for (const nested of child.children) {
      if (typeof nested === 'string') continue
      if (nested.tag === 'ul' || nested.tag === 'ol') {
        blocks.push(...renderList(nested, { ...context, list: { ordered, level } }, nested.tag === 'ol'))
      }
    }
  }

  return blocks
}

function renderBlocks(children: HtmlChild[], context: BlockContext): DocxBlock[] {
  const blocks: DocxBlock[] = []
  let loose: DocxRun[] = []

  const flushLoose = () => {
    const runs = normalizeRuns(loose)
    loose = []
    if (runs.length) blocks.push(textBlock(runs, context))
  }

  for (const child of children) {
    if (typeof child === 'string') {
      loose.push(...inlineRuns([child], {}))
      continue
    }

    const { tag } = child

    if (tag === 'br') {
      loose.push({ text: '\n' })
      continue
    }
    if (tag === 'hr') {
      flushLoose()
      blocks.push({ type: 'divider' })
      continue
    }
    if (tag === 'img') {
      flushLoose()
      blocks.push({
        type: 'image',
        alt: (child.attrs.alt ?? '').trim(),
        src: (child.attrs.src ?? '').trim(),
      })
      continue
    }
    if (HEADING_TAGS.has(tag)) {
      flushLoose()
      const runs = normalizeRuns(inlineRuns(child.children, {}))
      if (runs.length) blocks.push({ type: 'heading', level: Number(tag.slice(1)), runs })
      continue
    }
    if (tag === 'p') {
      const runs = normalizeRuns(inlineRuns(child.children, {}))
      if (runs.length) blocks.push(textBlock(runs, context))
      continue
    }
    if (tag === 'pre') {
      flushLoose()
      const lines = preText(child).replace(/\t/g, '  ').split('\n')
      while (lines.length && !lines[0].trim()) lines.shift()
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
      if (lines.length) blocks.push({ type: 'code', lines })
      continue
    }
    if (tag === 'blockquote') {
      flushLoose()
      blocks.push(...renderBlocks(child.children, { ...context, quote: true }))
      continue
    }
    if (tag === 'ul' || tag === 'ol') {
      flushLoose()
      blocks.push(...renderList(child, context, tag === 'ol'))
      continue
    }
    if (tag === 'table') {
      flushLoose()
      const table = tableBlock(child)
      if (table) blocks.push(table)
      continue
    }
    if (tag === 'figcaption') {
      flushLoose()
      const runs = normalizeRuns(inlineRuns(child.children, {}))
      if (runs.length) blocks.push({ type: 'caption', runs })
      continue
    }
    if (INLINE_TAGS.has(tag)) {
      loose.push(...inlineRuns([child], {}))
      continue
    }
    // Неизвестный контейнер (div, section, figure) — разбираем содержимое на месте.
    blocks.push(...renderBlocks(child.children, context))
  }

  flushLoose()
  return blocks
}

function htmlToBlocks(html: string | null | undefined): DocxBlock[] {
  if (!html) return []
  return renderBlocks(parseHtml(html), { quote: false })
}

function editionUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'
  return `${baseUrl}/vvvvv/${encodeURIComponent(slug)}`
}

export function buildEditionDocx({
  release,
  editionSlug,
  editionFormat,
  chapters,
}: {
  release: Release
  editionSlug: string
  editionFormat: EditionFormat
  chapters: Chapter[]
}): Buffer {
  const formatLabel = EDITION_FORMAT_LABELS[editionFormat] ?? editionFormat
  const authors = release.authors
    .map((author) => author.name)
    .filter(Boolean)
    .join(', ')
  const blocks: DocxBlock[] = []

  if (editionFormat !== 'book') {
    blocks.push({
      type: 'paragraph',
      quote: true,
      runs: [
        {
          text: `Word-текст недоступен для этого издания: оно опубликовано в формате «${formatLabel}» и не предназначено для представления как цельный книжный текст.`,
        },
      ],
    })
    blocks.push({
      type: 'listItem',
      ordered: false,
      level: 0,
      runs: [{ text: `Релиз: ${release.title}` }],
    })
    blocks.push({ type: 'listItem', ordered: false, level: 0, runs: [{ text: `Формат: ${formatLabel}` }] })
    blocks.push({ type: 'listItem', ordered: false, level: 0, runs: [{ text: `Издание: ${editionSlug}` }] })
    blocks.push({
      type: 'listItem',
      ordered: false,
      level: 0,
      runs: [
        { text: 'Страница издания: ' },
        { text: editionUrl(editionSlug), href: editionUrl(editionSlug) },
      ],
    })
    return buildDocx({ title: release.title, subtitle: formatLabel, author: authors, blocks })
  }

  blocks.push(...htmlToBlocks(release.annotation))

  for (const chapter of chapters) {
    if (chapters.length > 1) {
      blocks.push({
        type: 'heading',
        level: 2,
        runs: [{ text: chapter.title }],
        pageBreakBefore: true,
      })
    }
    blocks.push(...htmlToBlocks(chapter.content))
  }

  blocks.push({
    type: 'caption',
    runs: [
      { text: 'Источник: ' },
      { text: editionUrl(editionSlug), href: editionUrl(editionSlug) },
    ],
  })

  const subtitle = authors ? `${authors} · ${formatLabel}` : formatLabel
  return buildDocx({ title: release.title, subtitle, author: authors, blocks })
}
