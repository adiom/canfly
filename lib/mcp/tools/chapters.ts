import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
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
import { json, notFound, toolError } from '@/lib/mcp/tool-result'

const uuid = z.uuid()

const chapterStatus = z.enum(['draft', 'published'])

export function registerChaptersTools(server: McpServer) {
  server.registerTool(
    'canfly_list_chapters',
    {
      title: 'Главы издания',
      description:
        'Список глав издания без контента — для оглавления. Возвращает id, title, chapter_index, status, word_count, audio_url.',
      inputSchema: z.object({ edition_id: uuid.describe('UUID издания') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ edition_id }) => json(await fetchChaptersByEdition(edition_id)),
  )

  server.registerTool(
    'canfly_get_chapter',
    {
      title: 'Глава целиком',
      description:
        'Получить одну главу со всем текстом (content). Содержимое автоматически санитизируется.',
      inputSchema: z.object({ id: uuid.describe('UUID главы') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const chapter = await fetchChapterById(id)
      return chapter ? json(chapter) : notFound('Глава', id)
    },
  )

  server.registerTool(
    'canfly_create_chapter',
    {
      title: 'Создать главу',
      description:
        'Создать новую черновую главу в издании. chapter_index — порядковый номер (1-based). content — HTML.',
      inputSchema: z.object({
        edition_id: uuid.describe('UUID издания'),
        title: z.string().describe('Название главы'),
        content: z.string().optional().describe('HTML-контент главы'),
        chapter_index: z.number().int().min(1).describe('Порядковый номер (1-based)'),
        status: chapterStatus.optional().describe('Статус (по умолчанию draft)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (data) => json(await createChapter({ ...data, word_count: countWords(data.content) })),
  )

  server.registerTool(
    'canfly_update_chapter',
    {
      title: 'Обновить главу',
      description:
        'Обновить главу. Апдейт частичный: непереданные поля (включая аудио) сохраняют текущее значение. Если контент меняется и там уже был текст, старая версия автоматически уходит в chapter_versions.',
      inputSchema: z.object({
        id: uuid.describe('UUID главы'),
        title: z.string().optional().describe('Название главы'),
        content: z.string().optional().describe('Новый HTML-контент'),
        chapter_index: z.number().int().min(1).optional().describe('Новый порядковый номер'),
        status: chapterStatus.optional().describe('Статус'),
        audio_url: z.string().nullable().optional().describe('URL аудио-файла (null — отвязать)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id, ...data }) => {
      const existing = await fetchChapterById(id)
      if (!existing) return notFound('Глава', id)

      if (data.content && existing.content && data.content !== existing.content) {
        await createChapterVersion(id, existing.content)
      }

      const updated = await updateChapter(id, {
        ...data,
        // word_count пересчитываем только когда пришёл новый текст: иначе
        // счётчик разъедется с содержимым при апдейте одного заголовка.
        ...(data.content === undefined ? {} : { word_count: countWords(data.content) }),
      })
      return json(updated)
    },
  )

  server.registerTool(
    'canfly_publish_chapter',
    {
      title: 'Опубликовать главу',
      description: 'Опубликовать главу (status → published, published_at = now). Идемпотентно.',
      inputSchema: z.object({ id: uuid.describe('UUID главы') }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id }) => {
      const chapter = await publishChapter(id)
      return chapter ? json(chapter) : notFound('Глава', id)
    },
  )

  server.registerTool(
    'canfly_list_chapter_versions',
    {
      title: 'История версий главы',
      description:
        'История версий контента главы. Каждая версия содержит id, content, version_number, created_at.',
      inputSchema: z.object({ chapter_id: uuid.describe('UUID главы') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ chapter_id }) => json(await fetchChapterVersions(chapter_id)),
  )

  server.registerTool(
    'canfly_restore_chapter_version',
    {
      title: 'Откатить главу к версии',
      description:
        'Откатить главу к сохранённой версии. Текущее содержимое тоже сохраняется как новая версия, поэтому откат не теряет данные.',
      inputSchema: z.object({
        chapter_id: uuid.describe('UUID главы'),
        version_id: uuid.describe('UUID версии для восстановления'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ chapter_id, version_id }) => {
      const restored = await restoreChapterVersion(chapter_id, version_id)
      return restored ? json(restored) : toolError('Версия не найдена или не принадлежит главе')
    },
  )
}
