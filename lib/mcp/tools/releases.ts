import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  listAllReleasesWithEditions,
  fetchReleaseById,
  createRelease,
  updateRelease,
  updateReleaseStatus,
  fetchReleaseCharacters,
  setReleaseCharacters,
  fetchReleaseSeries,
  setReleaseSeries,
} from '@/lib/server/releases'
import {
  fetchEditionsByRelease,
  fetchEditionById,
  createEdition,
  updateEdition,
} from '@/lib/server/editions'
import { fetchReleasePlaces, setReleasePlaces } from '@/lib/server/places'
import { json, notFound, pick, withToolCatch } from '@/lib/mcp/tool-result'

const uuid = z.uuid()

const contentStatus = z.enum(['draft', 'published', 'archived'])

const editionFormat = z.enum([
  'book',
  'comic',
  'audiobook',
  'audiorelease',
  'album',
  'magazine',
  'digital',
  'artwork',
])

const qualityTier = z.enum(['draft', 'standard', 'premium'])

const releaseCharacterRole = z.enum(['main', 'supporting', 'cameo'])

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
    withToolCatch(async ({ limit, offset }) => {
      // Пагинация в памяти: fetchReleasesPage умеет только по одному статусу,
      // а здесь нужны черновики и опубликованные вместе.
      const all = await listAllReleasesWithEditions()
      return json({
        total: all.length,
        items: all.slice(offset, offset + limit).map((r) => pick(r, releaseListFields)),
      })
    }),
  )

  server.registerTool(
    'canfly_get_release',
    {
      title: 'Релиз по ID',
      description: 'Получить релиз по ID со списком его изданий. Возвращает объект release + массив editions.',
      inputSchema: z.object({ id: uuid.describe('UUID релиза') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ id }) => {
      const release = await fetchReleaseById(id)
      if (!release) return notFound('Релиз', id)
      const editions = await fetchEditionsByRelease(id)
      return json({ ...release, editions })
    }),
  )

  server.registerTool(
    'canfly_create_release',
    {
      title: 'Создать релиз',
      description:
        'Создать новый релиз. slug генерируется автоматически из title, если не передан; при конфликте добавляется числовой суффикс. authors — массив [{name, role}].',
      inputSchema: z.object({
        title: z.string().min(1).describe('Название релиза'),
        slug: z.string().optional().describe('Slug (генерируется из title, если не передан)'),
        description: z.string().optional().describe('Описание'),
        cover_image: z.string().optional().describe('URL обложки'),
        genre: z.string().optional().describe('Жанр'),
        release_date: z.string().optional().describe('Дата релиза (YYYY-MM-DD)'),
        isbn: z.string().optional().describe('ISBN'),
        authors: z
          .array(z.object({ name: z.string(), role: z.string() }))
          .optional()
          .describe('Авторы'),
        annotation: z.string().optional().describe('Аннотация'),
        editor_notes: z.string().optional().describe('Редакторские заметки'),
        status: contentStatus.optional().describe('Статус (по умолчанию draft)'),
        show_in_catalog: z.boolean().optional().describe('Показывать на /releases (по умолчанию true)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    withToolCatch(async (data) => json(await createRelease(data))),
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
        status: contentStatus.optional().describe('Статус'),
        show_in_catalog: z.boolean().optional().describe('Показывать на /releases'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ id, ...data }) => {
      const release = await updateRelease(id, data)
      return release ? json(release) : notFound('Релиз', id)
    }),
  )

  server.registerTool(
    'canfly_set_release_status',
    {
      title: 'Статус релиза',
      description: 'Точечно изменить статус релиза (draft/published/archived).',
      inputSchema: z.object({
        id: uuid.describe('UUID релиза'),
        status: contentStatus.describe('Новый статус'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withToolCatch(async ({ id, status }) => {
      const release = await updateReleaseStatus(id, status)
      return release ? json(release) : notFound('Релиз', id)
    }),
  )

  server.registerTool(
    'canfly_get_edition',
    {
      title: 'Издание по ID',
      description: 'Получить одно издание по ID (формат, tier, статус, slug).',
      inputSchema: z.object({ id: uuid.describe('UUID издания') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ id }) => {
      const edition = await fetchEditionById(id)
      return edition ? json(edition) : notFound('Издание', id)
    }),
  )

  server.registerTool(
    'canfly_create_edition',
    {
      title: 'Создать издание',
      description:
        'Добавить формат (book/comic/audiobook/audiorelease/album/magazine/digital/artwork) к релизу. slug генерируется автоматически из слага релиза: {release-slug}-0, -1, -2…',
      inputSchema: z.object({
        release_id: uuid.describe('UUID релиза'),
        format: editionFormat.optional().describe('Формат (по умолчанию book)'),
        platform: z.string().nullable().optional().describe('Платформа'),
        external_url: z.string().nullable().optional().describe('Ссылка на внешнюю площадку'),
        artwork_url: z.string().nullable().optional().describe('URL обложки издания'),
        slug: z.string().optional().describe('Явный slug (иначе генерируется из релиза)'),
        quality_tier: qualityTier.optional().describe('Качество (по умолчанию standard)'),
        status: contentStatus.optional().describe('Статус (по умолчанию draft)'),
        is_primary: z.boolean().optional().describe('Основное издание'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    withToolCatch(async (data) => json(await createEdition(data))),
  )

  server.registerTool(
    'canfly_update_edition',
    {
      title: 'Обновить издание',
      description:
        'Настройки издания: формат, платформа, внешняя ссылка, обложка, slug, статус, основной флаг, качество. Апдейт частичный.',
      inputSchema: z.object({
        id: uuid.describe('UUID издания'),
        format: editionFormat.optional().describe('Формат'),
        platform: z.string().nullable().optional().describe('Платформа'),
        external_url: z.string().nullable().optional().describe('Ссылка на внешнюю площадку'),
        artwork_url: z.string().nullable().optional().describe('URL обложки издания'),
        slug: z.string().optional().describe('Новый slug'),
        quality_tier: qualityTier.optional().describe('Качество'),
        status: contentStatus.optional().describe('Статус'),
        is_primary: z.boolean().optional().describe('Основное издание'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ id, ...data }) => {
      const edition = await updateEdition(id, data)
      return edition ? json(edition) : notFound('Издание', id)
    }),
  )

  server.registerTool(
    'canfly_list_release_characters',
    {
      title: 'Персонажи релиза',
      description: 'Персонажи, привязанные к релизу, с ролью main/supporting/cameo.',
      inputSchema: z.object({ release_id: uuid.describe('UUID релиза') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ release_id }) => {
      const items = await fetchReleaseCharacters(release_id)
      return json({ total: items.length, items })
    }),
  )

  server.registerTool(
    'canfly_set_release_characters',
    {
      title: 'Привязать персонажей к релизу',
      description:
        'Атомарно заменить список персонажей релиза. Пустой массив очищает связи. role: main/supporting/cameo.',
      inputSchema: z.object({
        release_id: uuid.describe('UUID релиза'),
        characters: z
          .array(z.object({
            character_id: uuid.describe('UUID персонажа'),
            role: releaseCharacterRole.describe('Роль в релизе'),
          }))
          .max(200)
          .describe('Полный новый список персонажей'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ release_id, characters }) => {
      await setReleaseCharacters(release_id, characters)
      return json({ ok: true, total: characters.length })
    }),
  )

  server.registerTool(
    'canfly_list_release_series',
    {
      title: 'Серии релиза',
      description: 'Серии, к которым привязан релиз, с номером фазы.',
      inputSchema: z.object({ release_id: uuid.describe('UUID релиза') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ release_id }) => {
      const items = await fetchReleaseSeries(release_id)
      return json({ total: items.length, items })
    }),
  )

  server.registerTool(
    'canfly_set_release_series',
    {
      title: 'Привязать серии к релизу',
      description:
        'Атомарно заменить список серий релиза. phase_number — номер внутри серии или null. Пустой массив очищает связи.',
      inputSchema: z.object({
        release_id: uuid.describe('UUID релиза'),
        series: z
          .array(z.object({
            series_id: uuid.describe('UUID серии'),
            phase_number: z.number().int().min(0).nullable().optional().describe('Номер фазы'),
          }))
          .max(50)
          .describe('Полный новый список серий'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ release_id, series }) => {
      await setReleaseSeries(
        release_id,
        series.map((item) => ({
          series_id: item.series_id,
          phase_number: item.phase_number ?? null,
        })),
      )
      return json({ ok: true, total: series.length })
    }),
  )

  server.registerTool(
    'canfly_list_release_places',
    {
      title: 'Места релиза',
      description: 'Локации, привязанные к релизу.',
      inputSchema: z.object({ release_id: uuid.describe('UUID релиза') }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ release_id }) => {
      const items = await fetchReleasePlaces(release_id)
      return json({ total: items.length, items })
    }),
  )

  server.registerTool(
    'canfly_set_release_places',
    {
      title: 'Привязать места к релизу',
      description:
        'Атомарно заменить список мест релиза. Пустой массив очищает связи.',
      inputSchema: z.object({
        release_id: uuid.describe('UUID релиза'),
        place_ids: z.array(uuid.describe('UUID места')).max(200).describe('Полный новый список мест'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ release_id, place_ids }) => {
      await setReleasePlaces(release_id, place_ids)
      return json({ ok: true, total: place_ids.length })
    }),
  )
}
