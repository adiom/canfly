import * as z from 'zod-v4'
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import {
  fetchChaptersByEdition,
  fetchChapterById,
  createChapter,
  updateChapter,
  publishChapter,
  fetchChapterVersions,
  restoreChapterVersion,
  reorderChapters,
} from '@/lib/server/chapters'
import { fetchEditionById } from '@/lib/server/editions'
import { countWords } from '@/lib/mcp/word-count'
import { chapterReadPage, chapterTextMessage, chapterWriteReceipt } from '@/lib/mcp/chapter-response'
import { json, notFound, toolError, withToolCatch } from '@/lib/mcp/tool-result'
import { ChapterWriteError } from '@/lib/studio/chapter-write'

const uuid = z.uuid()

const chapterStatus = z.enum(['draft', 'published'])
const expectedRevision = z.number().int().min(0).max(2147483647)

const updateChapterInput = z.object({
  id: uuid.describe('UUID главы'),
  expected_revision: expectedRevision.optional(),
  title: z.string().refine(title => title.trim().length > 0).optional().describe('Название главы'),
  content: z.string().optional().describe('Новый HTML-контент'),
  chapter_index: z.number().int().min(1).optional().describe('Новый порядковый номер'),
  status: chapterStatus.optional().describe('Статус'),
  audio_url: z.string().nullable().optional().describe('URL аудио-файла (null — отвязать)'),
})

const restoreChapterInput = z.object({
  chapter_id: uuid.describe('UUID главы'),
  version_id: uuid.describe('UUID версии для восстановления'),
  expected_revision: expectedRevision.optional(),
})

async function updateChapterTool({ id, expected_revision, ...data }: z.infer<typeof updateChapterInput>) {
  const updated = await updateChapter(id, data, { expectedRevision: expected_revision })
  return updated ? json(chapterWriteReceipt(updated)) : notFound('Глава', id)
}

async function restoreChapterTool({ chapter_id, version_id, expected_revision }: z.infer<typeof restoreChapterInput>) {
  const restored = await restoreChapterVersion(chapter_id, version_id, expected_revision)
  return restored ? json(chapterWriteReceipt(restored)) : toolError('Версия не найдена или не принадлежит главе')
}

function withChapterConflict<Args>(handler: (args: Args) => Promise<CallToolResult>) {
  return withToolCatch(async (args: Args) => {
    try {
      return await handler(args)
    } catch (error) {
      if (!(error instanceof ChapterWriteError) || error.code !== 'conflict') throw error
      const failure = {
        ok: false,
        code: error.code,
        message: 'Глава изменилась. Перечитайте главу и сверьте правки перед повтором.',
      }
      return { ...json(failure), isError: true, structuredContent: failure }
    }
  })
}

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
    withToolCatch(async ({ edition_id }) => json(await fetchChaptersByEdition(edition_id))),
  )

  server.registerTool(
    'canfly_get_chapter',
    {
      title: 'Текст главы (постранично)',
      description:
        'Получить текст главы, включая черновики. offset/limit в Unicode-символах; при next_offset != null продолжить чтение с него. content_hash сверяет целостность между страницами. По умолчанию до 8000 символов.',
      inputSchema: z.object({
        id: uuid.describe('UUID главы'),
        offset: z.number().int().min(0).default(0).describe('Сдвиг от начала текста, в Unicode-символах'),
        limit: z.number().int().min(1).max(12000).default(8000).describe('Максимум символов страницы'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ id, offset, limit }) => {
      const chapter = await fetchChapterById(id)
      return chapter ? json(chapterReadPage(chapter, offset, limit)) : notFound('Глава', id)
    }),
  )

  // Резервный способ для клиентов, которым не удаётся распаковать
  // JSON-ответ canfly_get_chapter: здесь один обычный текстовый MCP-блок.
  server.registerTool(
    'canfly_read_chapter_text',
    {
      title: 'Читать главу — текстовый ответ',
      description:
        'Чтение главы, включая черновики. Альтернатива canfly_get_chapter: возвращает фрагмент очищенного HTML непосредственно текстом, без JSON. NEXT_OFFSET указывает следующую позицию, END — конец. Начните с offset=0.',
      inputSchema: z.object({
        id: uuid.describe('UUID главы'),
        offset: z.number().int().min(0).default(0).describe('Смещение в Unicode-символах'),
        limit: z.number().int().min(1).max(3000).default(1500).describe('Не более 3000 символов'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ id, offset, limit }) => {
      const chapter = await fetchChapterById(id)
      if (!chapter) return notFound('Глава', id)
      return {
        content: [{ type: 'text', text: chapterTextMessage(chapter, offset, limit) }],
      }
    }),
  )

  server.registerTool(
    'canfly_create_chapter',
    {
      title: 'Создать главу',
      description:
        'Создать новую черновую главу в издании. chapter_index — порядковый номер (1-based). content — HTML, перед записью очищается.',
      inputSchema: z.object({
        edition_id: uuid.describe('UUID издания'),
        title: z.string().min(1).describe('Название главы'),
        content: z.string().optional().describe('HTML-контент главы'),
        chapter_index: z.number().int().min(1).describe('Порядковый номер (1-based)'),
        status: chapterStatus.optional().describe('Статус (по умолчанию draft)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    withToolCatch(async (data) => {
      const edition = await fetchEditionById(data.edition_id)
      if (!edition) return notFound('Издание', data.edition_id)

      const chapter = await createChapter({
        ...data,
        word_count: countWords(data.content),
      })
      return chapter ? json(chapterWriteReceipt(chapter)) : toolError('Не удалось создать главу')
    }),
  )

  server.registerTool(
    'canfly_update_chapter',
    {
      title: 'Обновить главу (устарело)',
      description:
        'Устарело: используйте canfly_update_chapter_v2. Без expected_revision возможна перезапись свежих данных. Непереданные поля сохраняются, заменяемый непустой текст архивируется, HTML очищается.',
      inputSchema: updateChapterInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(updateChapterTool),
  )

  server.registerTool(
    'canfly_update_chapter_v2',
    {
      title: 'Обновить главу с проверкой ревизии',
      description:
        'Обновить переданные поля с expected_revision из canfly_get_chapter. При несовпадении ревизий возвращает conflict. Заменяемый непустой текст архивируется, HTML очищается.',
      inputSchema: updateChapterInput.extend({ expected_revision: expectedRevision }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withChapterConflict(updateChapterTool),
  )

  server.registerTool(
    'canfly_reorder_chapters',
    {
      title: 'Порядок глав',
      description:
        'Переупорядочить все главы издания. chapter_ids — полный список UUID в новом порядке; индексы станут 1..N.',
      inputSchema: z.object({
        edition_id: uuid.describe('UUID издания'),
        chapter_ids: z.array(uuid.describe('UUID главы')).min(1).max(1000)
          .describe('Все главы издания в новом порядке'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ edition_id, chapter_ids }) => {
      const edition = await fetchEditionById(edition_id)
      if (!edition) return notFound('Издание', edition_id)

      await reorderChapters(edition_id, chapter_ids)
      return json({ ok: true, total: chapter_ids.length })
    }),
  )

  server.registerTool(
    'canfly_publish_chapter',
    {
      title: 'Опубликовать главу',
      description: 'Опубликовать главу (status → published, published_at = now). Идемпотентно.',
      inputSchema: z.object({ id: uuid.describe('UUID главы') }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolCatch(async ({ id }) => {
      const chapter = await publishChapter(id)
      return chapter ? json(chapterWriteReceipt(chapter)) : notFound('Глава', id)
    }),
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
    withToolCatch(async ({ chapter_id }) => json(await fetchChapterVersions(chapter_id))),
  )

  server.registerTool(
    'canfly_restore_chapter_version',
    {
      title: 'Откатить главу к версии (устарело)',
      description:
        'Устарело: используйте canfly_restore_chapter_version_v2. Без expected_revision возможна перезапись свежих данных. Текущее непустое содержимое сохраняется как новая версия.',
      inputSchema: restoreChapterInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    withToolCatch(restoreChapterTool),
  )

  server.registerTool(
    'canfly_restore_chapter_version_v2',
    {
      title: 'Откатить главу к версии с проверкой ревизии',
      description:
        'Восстановить сохранённую версию с expected_revision из canfly_get_chapter. При несовпадении ревизий возвращает conflict. Текущее непустое содержимое сохраняется как новая версия.',
      inputSchema: restoreChapterInput.extend({ expected_revision: expectedRevision }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    withChapterConflict(restoreChapterTool),
  )
}
