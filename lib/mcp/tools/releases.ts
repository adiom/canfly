import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  listAllReleasesWithEditions,
  fetchReleaseById,
  createRelease,
  updateRelease,
  updateReleaseStatus,
} from '@/lib/server/releases'
import { fetchEditionsByRelease, fetchEditionById, createEdition } from '@/lib/server/editions'
import { json, notFound, pick } from '@/lib/mcp/tool-result'

const uuid = z.uuid()

const releaseStatus = z.enum(['draft', 'published', 'archived'])

const editionFormat = z.enum([
  'book',
  'comic',
  'audiobook',
  'audiorelease',
  'album',
  'magazine',
  'digital',
])

/** Поля карточки релиза в списке — без annotation/editor_notes/design_config. */
const releaseListFields = [
  'id',
  'title',
  'slug',
  'status',
  'genre',
  'release_date',
  'formats',
  'edition_count',
  'updated_at',
] as const

/** Изменяемые поля релиза перечислены прямо в схемах тулов ниже. */

export function registerReleasesTools(server: McpServer) {
  server.registerTool(
    'canfly_list_releases',
    {
      title: 'Список релизов',
      description:
        'Все релизы (включая черновики) с форматами изданий. Возвращает укороченные карточки: id, title, slug, status, genre, release_date, formats[], edition_count. Полные данные — через canfly_get_release.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(50).describe('Сколько вернуть'),
        offset: z.number().int().min(0).default(0).describe('Сдвиг для постраничного обхода'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit, offset }) => {
      // Пагинация в памяти: fetchReleasesPage умеет только по одному статусу,
      // а здесь нужны черновики и опубликованные вместе.
      const all = await listAllReleasesWithEditions()
      return json({
        total: all.length,
        items: all.slice(offset, offset + limit).map((r) => pick(r, releaseListFields)),
      })
    },
  )

  server.registerTool(
    'canfly_get_release',
    {
      title: 'Релиз по ID',
      description: 'Получить релиз по ID со списком его изданий. Возвращает объект release + массив editions.',
      inputSchema: z.object({ id: uuid.describe('UUID релиза') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const release = await fetchReleaseById(id)
      if (!release) return notFound('Релиз', id)
      const editions = await fetchEditionsByRelease(id)
      return json({ ...release, editions })
    },
  )

  server.registerTool(
    'canfly_create_release',
    {
      title: 'Создать релиз',
      description:
        'Создать новый релиз. slug генерируется автоматически, если не передан. authors — массив [{name, role}].',
      inputSchema: z.object({
        title: z.string().describe('Название релиза'),
        slug: z.string().optional().describe('Slug (генерируется из title, если не передан)'),
        description: z.string().optional().describe('Описание'),
        genre: z.string().optional().describe('Жанр'),
        release_date: z.string().optional().describe('Дата релиза (YYYY-MM-DD)'),
        isbn: z.string().optional().describe('ISBN'),
        authors: z
          .array(z.object({ name: z.string(), role: z.string() }))
          .optional()
          .describe('Авторы'),
        annotation: z.string().optional().describe('Аннотация'),
        editor_notes: z.string().optional().describe('Редакторские заметки'),
        status: releaseStatus.optional().describe('Статус (по умолчанию draft)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (data) => json(await createRelease(data)),
  )

  server.registerTool(
    'canfly_update_release',
    {
      title: 'Обновить релиз',
      description:
        'Обновить релиз. Апдейт частичный: непереданные поля сохраняют текущее значение, явный null очищает поле.',
      inputSchema: z.object({
        id: uuid.describe('UUID релиза'),
        title: z.string().optional().describe('Название'),
        slug: z.string().optional().describe('Slug'),
        description: z.string().nullable().optional().describe('Описание'),
        genre: z.string().nullable().optional().describe('Жанр'),
        release_date: z.string().nullable().optional().describe('Дата релиза (YYYY-MM-DD)'),
        isbn: z.string().nullable().optional().describe('ISBN'),
        authors: z
          .array(z.object({ name: z.string(), role: z.string() }))
          .optional()
          .describe('Авторы'),
        annotation: z.string().nullable().optional().describe('Аннотация'),
        editor_notes: z.string().nullable().optional().describe('Редакторские заметки'),
        cover_image: z.string().nullable().optional().describe('URL обложки'),
        status: releaseStatus.optional().describe('Статус'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id, ...data }) => {
      const release = await updateRelease(id, data)
      return release ? json(release) : notFound('Релиз', id)
    },
  )

  server.registerTool(
    'canfly_set_release_status',
    {
      title: 'Статус релиза',
      description: 'Точечно изменить статус релиза (draft/published/archived).',
      inputSchema: z.object({
        id: uuid.describe('UUID релиза'),
        status: releaseStatus.describe('Новый статус'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, status }) => {
      const release = await updateReleaseStatus(id, status)
      return release ? json(release) : notFound('Релиз', id)
    },
  )

  server.registerTool(
    'canfly_get_edition',
    {
      title: 'Издание по ID',
      description: 'Получить одно издание по ID (формат, tier, статус, slug).',
      inputSchema: z.object({ id: uuid.describe('UUID издания') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const edition = await fetchEditionById(id)
      return edition ? json(edition) : notFound('Издание', id)
    },
  )

  server.registerTool(
    'canfly_create_edition',
    {
      title: 'Создать издание',
      description:
        'Добавить формат (book/comic/audiobook/audiorelease/album/magazine/digital) к релизу. slug генерируется автоматически.',
      inputSchema: z.object({
        release_id: uuid.describe('UUID релиза'),
        format: editionFormat.optional().describe('Формат (по умолчанию book)'),
        platform: z.string().optional().describe('Платформа'),
        quality_tier: z
          .enum(['draft', 'standard', 'premium'])
          .optional()
          .describe('Качество (по умолчанию standard)'),
        status: releaseStatus.optional().describe('Статус (по умолчанию draft)'),
        is_primary: z.boolean().optional().describe('Основное издание'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (data) => json(await createEdition(data)),
  )
}
