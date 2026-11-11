import { createHash } from 'node:crypto'
import type { Chapter } from '@/lib/releases-types'

/** Контрольная сумма сохранённого текста, а не HTML, полученного от клиента. */
export function chapterDigest(content: string | null): string {
  return createHash('sha256').update(content ?? '', 'utf8').digest('hex')
}

/** Успешная запись возвращает метаданные, не дублируя текст главы. */
export function chapterWriteReceipt(chapter: Chapter) {
  return {
    ok: true,
    id: chapter.id,
    edition_id: chapter.edition_id,
    title: chapter.title,
    chapter_index: chapter.chapter_index,
    status: chapter.status,
    word_count: chapter.word_count,
    content_hash: chapterDigest(chapter.content),
    updated_at: chapter.updated_at,
  }
}

/**
 * offset/limit считаются в Unicode code points, чтобы не разрывать эмодзи
 * или редкие символы на границе страницы.
 */
export function chapterReadPage(chapter: Chapter, offset: number, limit: number) {
  const symbols = Array.from(chapter.content ?? '')
  const next = offset + limit
  return {
    ...chapterWriteReceipt(chapter),
    content: symbols.slice(offset, next).join(''),
    offset,
    total_length: symbols.length,
    next_offset: next < symbols.length ? next : null,
  }
}

/**
 * Альтернативный канал чтения для MCP-клиентов, не распаковывающих JSON
 * результата canfly_get_chapter. Один текстовый блок, без вложенного JSON.
 * Содержимое передаётся как HTML (без потери исходного форматирования).
 */
export function chapterTextMessage(chapter: Chapter, offset: number, limit: number): string {
  const page = chapterReadPage(chapter, offset, limit)
  return [
    `CHAPTER ${page.id}: ${page.title}`,
    `STATUS: ${page.status}`,
    `OFFSET: ${page.offset}/${page.total_length}`,
    `NEXT_OFFSET: ${page.next_offset ?? 'END'}`,
    `CONTENT_SHA256: ${page.content_hash}`,
    '--- HTML START ---',
    page.content || '[Глава пуста или смещение за пределами текста]',
    '--- HTML END ---',
  ].join('\n')
}
