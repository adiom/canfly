import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  fetchChaptersByEdition,
  fetchChapterById,
  createChapter,
  updateChapter,
  publishChapter,
  createChapterVersion,
  fetchChapterVersions,
  restoreChapterVersion,
} from '@/lib/server/chapters'
import { countWords } from '@/lib/mcp/word-count'

export function registerChaptersTools(server: McpServer) {
  server.tool(
    'canfly_list_chapters',
    'Получить список глав издания (без контента) — для оглавления. Возвращает массив с id, title, chapter_index, status, word_count, audio_url.',
    {
      edition_id: z.string().describe('UUID издания'),
    },
    async ({ edition_id }) => {
      try {
        const chapters = await fetchChaptersByEdition(edition_id)
        return { content: [{ type: 'text', text: JSON.stringify(chapters, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_get_chapter',
    'Получить одну главу со всем текстом (content). Содержимое автоматически санитизируется. Возвращает полный объект Chapter.',
    {
      id: z.string().describe('UUID главы'),
    },
    async ({ id }) => {
      try {
        const chapter = await fetchChapterById(id)
        if (!chapter) {
          return { content: [{ type: 'text', text: `Глава с id="${id}" не найдена` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(chapter, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_create_chapter',
    'Создать новую черновую главу в издании. chapter_index — порядковый номер (1-based). content — HTML. Статус по умолчанию draft. Возвращает созданную главу.',
    {
      edition_id: z.string().describe('UUID издания'),
      title: z.string().describe('Название главы'),
      content: z.string().optional().describe('HTML-контент главы'),
      chapter_index: z.number().int().min(1).describe('Порядковый номер (1-based)'),
      status: z.enum(['draft', 'published']).optional().describe('Статус (по умолчанию draft)'),
    },
    async (data) => {
      try {
        const wordCount = countWords(data.content)
        const chapter = await createChapter({
          ...data,
          word_count: wordCount,
        })
        return { content: [{ type: 'text', text: JSON.stringify(chapter, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_update_chapter',
    'Обновить главу. Если контент меняется и там уже был текст — старая версия автоматически сохраняется в chapter_versions. ОБЯЗАТЕЛЬНО сначала прочитать главу через canfly_get_chapter. Возвращает обновлённую главу.',
    {
      id: z.string().describe('UUID главы'),
      title: z.string().optional().describe('Название главы'),
      content: z.string().optional().describe('Новый HTML-контент'),
      chapter_index: z.number().int().optional().describe('Новый порядковый номер'),
      status: z.enum(['draft', 'published']).optional().describe('Статус'),
      audio_url: z.string().optional().describe('URL аудио-файла'),
    },
    async ({ id, ...data }) => {
      try {
        const existing = await fetchChapterById(id)
        if (!existing) {
          return { content: [{ type: 'text', text: `Глава с id="${id}" не найдена` }], isError: true }
        }

        // Автоматическое версионирование: если контент изменился
        const newContent = data.content ?? existing.content
        if (data.content && existing.content && data.content !== existing.content) {
          await createChapterVersion(id, existing.content)
        }

        const wordCount = countWords(newContent)

        const updated = await updateChapter(id, {
          title: data.title ?? existing.title,
          content: newContent,
          chapter_index: data.chapter_index ?? existing.chapter_index,
          status: data.status ?? existing.status,
          word_count: wordCount,
        })
        return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_publish_chapter',
    'Опубликовать главу (status → published, published_at = now). Идемпотентно: повторный вызов не ломает.',
    {
      id: z.string().describe('UUID главы'),
    },
    async ({ id }) => {
      try {
        const chapter = await publishChapter(id)
        if (!chapter) {
          return { content: [{ type: 'text', text: `Глава с id="${id}" не найдена` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(chapter, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_list_chapter_versions',
    'Получить историю версий контента главы. Каждая версия содержит id, content, version_number, created_at.',
    {
      chapter_id: z.string().describe('UUID главы'),
    },
    async ({ chapter_id }) => {
      try {
        const versions = await fetchChapterVersions(chapter_id)
        return { content: [{ type: 'text', text: JSON.stringify(versions, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_restore_chapter_version',
    'Откатить главу к сохранённой версии. Текущее содержимое тоже сохраняется как новая версия (откат не теряет данные). Возвращает обновлённую главу.',
    {
      chapter_id: z.string().describe('UUID главы'),
      version_id: z.string().describe('UUID версии для восстановления'),
    },
    async ({ chapter_id, version_id }) => {
      try {
        const restored = await restoreChapterVersion(chapter_id, version_id)
        if (!restored) {
          return {
            content: [{ type: 'text', text: `Версия не найдена или не принадлежит главе` }],
            isError: true,
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(restored, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )
}
