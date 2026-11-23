import { randomUUID } from 'node:crypto'
import * as z from 'zod-v4'
import type { CallToolResult, McpServer, ServerContext } from '@modelcontextprotocol/server'
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
import { fetchChapterLease, type ChapterLeaseActor } from '@/lib/server/chapter-leases'
import { fetchEditionById } from '@/lib/server/editions'
import { countWords } from '@/lib/mcp/word-count'
import { chapterReadPage, chapterTextMessage, chapterWriteReceipt } from '@/lib/mcp/chapter-response'
import { json, notFound, toolError } from '@/lib/mcp/tool-result'
import { ChapterWriteError, chapterWriteMessages, type ChapterWriteCode } from '@/lib/studio/chapter-write'

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

/**
 * MCP пишет от имени администратора. Для OAuth-токена известен user_id, для
 * статического MCP_TOKEN — нет; тогда lease хранит actor_kind='mcp' без user_id.
 */
function mcpActor(ctx?: ServerContext): ChapterLeaseActor {
  const auth = ctx?.http?.req?.auth
  const userId = auth?.extra?.userId
  return { userId: typeof userId === 'string' ? userId : null, actorKind: 'mcp' }
}

/**
 * Неявный lease: захватывается и освобождается в той же транзакции записи,
 * поэтому активную Studio-сессию нельзя вытеснить, а зависших lease не остаётся.
 */
function implicitLease(actor: ChapterLeaseActor) {
  return { mode: 'implicit' as const, actor, sessionId: `mcp-${randomUUID()}` }
}

function failure(code: string, message: string): CallToolResult {
  const body = { ok: false, code, message }
  return { ...json(body), isError: true, structuredContent: body }
}

function revisionRequired(tool: string): CallToolResult {
  return failure(
    'revision_required',
    `Перечитайте главу через canfly_get_chapter и повторите запись с expected_revision${tool ? ` (${tool})` : ''}. Запись без ревизии отклонена, чтобы не перезаписать свежий текст.`,
  )
}

const leaseMessages: Partial<Record<ChapterWriteCode, string>> = {
  'lease-held': 'Глава уже редактируется в другой сессии. Ничего не изменено.',
  'lease-lost': 'Право редактирования потеряно. Перечитайте главу и повторите правку.',
  conflict: 'Глава изменилась. Перечитайте главу и сверьте правки перед повтором.',
  'not-found': 'Глава удалена или недоступна.',
  'version-not-found': 'Версия не найдена или не принадлежит главе.',
  validation: chapterWriteMessages.validation,
}

/** Ошибки репозитория превращаем в структурированный ответ для модели. */
function chapterTool<Args>(
  handler: (args: Args, ctx: ServerContext) => Promise<CallToolResult>,
) {
  return async (args: Args, ctx: ServerContext): Promise<CallToolResult> => {
    try {
      return await handler(args, ctx)
    } catch (error) {
      if (error instanceof ChapterWriteError) {
        return failure(error.code.replaceAll('-', '_'), leaseMessages[error.code] ?? error.message)
      }
      throw error
    }
  }
}

async function updateChapterTool(
  { id, expected_revision, ...data }: z.infer<typeof updateChapterInput>,
  ctx: ServerContext,
) {
  if (expected_revision === undefined) return revisionRequired('canfly_update_chapter_v2')
  const updated = await updateChapter(id, data, {
    expectedRevision: expected_revision,
    lease: implicitLease(mcpActor(ctx)),
  })
  return updated ? json(chapterWriteReceipt(updated)) : notFound('Глава', id)
}

async function restoreChapterTool(
  { chapter_id, version_id, expected_revision }: z.infer<typeof restoreChapterInput>,
  ctx: ServerContext,
) {
  if (expected_revision === undefined) return revisionRequired('canfly_restore_chapter_version_v2')
  const restored = await restoreChapterVersion(chapter_id, version_id, {
    expectedRevision: expected_revision,
    lease: implicitLease(mcpActor(ctx)),
  })
  return restored ? json(chapterWriteReceipt(restored)) : toolError('Версия не найдена или не принадлежит главе')
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
    async ({ edition_id }) => json(await fetchChaptersByEdition(edition_id)),
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
    async ({ id, offset, limit }) => {
      const chapter = await fetchChapterById(id)
      return chapter ? json(chapterReadPage(chapter, offset, limit)) : notFound('Глава', id)
    },
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
    async ({ id, offset, limit }) => {
      const chapter = await fetchChapterById(id)
      if (!chapter) return notFound('Глава', id)
      return {
        content: [{ type: 'text', text: chapterTextMessage(chapter, offset, limit) }],
      }
    },
  )

  server.registerTool(
    'canfly_get_chapter_lease',
    {
      title: 'Кто редактирует главу',
      description:
        'Текущий владелец права редактирования главы. null — глава свободна. Запись возможна только при свободной главе: MCP захватывает lease на время одной операции.',
      inputSchema: z.object({ id: uuid.describe('UUID главы') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => json({ chapter_id: id, holder: await fetchChapterLease(id) }),
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
    async (data) => {
      const edition = await fetchEditionById(data.edition_id)
      if (!edition) return notFound('Издание', data.edition_id)

      const chapter = await createChapter({
        ...data,
        word_count: countWords(data.content),
      })
      return chapter ? json(chapterWriteReceipt(chapter)) : toolError('Не удалось создать главу')
    },
  )

  server.registerTool(
    'canfly_update_chapter',
    {
      title: 'Обновить главу (устарело)',
      description:
        'Устарело: используйте canfly_update_chapter_v2. Запрос без expected_revision отклоняется с revision_required. Непереданные поля сохраняются, заменяемый непустой текст архивируется, HTML очищается.',
      inputSchema: updateChapterInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    chapterTool(updateChapterTool),
  )

  server.registerTool(
    'canfly_update_chapter_v2',
    {
      title: 'Обновить главу с проверкой ревизии',
      description:
        'Обновить переданные поля с expected_revision из canfly_get_chapter. При несовпадении ревизий возвращает conflict, при чужой активной сессии — lease_held. Заменяемый непустой текст архивируется, HTML очищается.',
      inputSchema: updateChapterInput.extend({ expected_revision: expectedRevision }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    chapterTool(updateChapterTool),
  )

  server.registerTool(
    'canfly_reorder_chapters',
    {
      title: 'Порядок глав',
      description:
        'Переупорядочить все главы издания. chapter_ids — полный список UUID в новом порядке; expected_revisions — ревизии из того же снимка. Без ревизий запрос отклоняется, при живом lease любой главы — lease_held.',
      inputSchema: z.object({
        edition_id: uuid.describe('UUID издания'),
        chapter_ids: z.array(uuid.describe('UUID главы')).min(1).max(1000)
          .describe('Все главы издания в новом порядке'),
        expected_revisions: z.array(expectedRevision).min(1).max(1000).optional()
          .describe('Ревизии глав в том же порядке, что chapter_ids'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    chapterTool(async ({ edition_id, chapter_ids, expected_revisions }) => {
      const edition = await fetchEditionById(edition_id)
      if (!edition) return notFound('Издание', edition_id)
      if (!expected_revisions || expected_revisions.length !== chapter_ids.length) {
        return revisionRequired('canfly_reorder_chapters')
      }

      await reorderChapters(edition_id, chapter_ids.map((id, index) => ({
        id,
        revision: expected_revisions[index],
      })))
      return json({ ok: true, total: chapter_ids.length })
    }),
  )

  server.registerTool(
    'canfly_publish_chapter',
    {
      title: 'Опубликовать главу',
      description:
        'Опубликовать главу (status → published, published_at = now). Нужен expected_revision из canfly_get_chapter; без него запрос отклоняется. Идемпотентно.',
      inputSchema: z.object({
        id: uuid.describe('UUID главы'),
        expected_revision: expectedRevision.optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    chapterTool(async ({ id, expected_revision }, ctx) => {
      if (expected_revision === undefined) return revisionRequired('canfly_publish_chapter')
      const chapter = await publishChapter(id, {
        expectedRevision: expected_revision,
        lease: implicitLease(mcpActor(ctx)),
      })
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
    async ({ chapter_id }) => json(await fetchChapterVersions(chapter_id)),
  )

  server.registerTool(
    'canfly_restore_chapter_version',
    {
      title: 'Откатить главу к версии (устарело)',
      description:
        'Устарело: используйте canfly_restore_chapter_version_v2. Запрос без expected_revision отклоняется с revision_required. Текущее непустое содержимое сохраняется как новая версия.',
      inputSchema: restoreChapterInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    chapterTool(restoreChapterTool),
  )

  server.registerTool(
    'canfly_restore_chapter_version_v2',
    {
      title: 'Откатить главу к версии с проверкой ревизии',
      description:
        'Восстановить сохранённую версию с expected_revision из canfly_get_chapter. При несовпадении ревизий возвращает conflict, при чужой активной сессии — lease_held. Текущее непустое содержимое сохраняется как новая версия.',
      inputSchema: restoreChapterInput.extend({ expected_revision: expectedRevision }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    chapterTool(restoreChapterTool),
  )
}
