import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  listAllReleasesWithEditions,
  fetchReleaseById,
  createRelease,
  updateRelease,
  updateReleaseStatus,
} from '@/lib/server/releases'
import { fetchEditionsByRelease, fetchEditionById, createEdition } from '@/lib/server/editions'

export function registerReleasesTools(server: McpServer) {
  server.tool(
    'canfly_list_releases',
    'Получить все релизы (включая черновики) со списком форматов изданий. Возвращает массив объектов Release с полями formats[] и edition_count.',
    {},
    async () => {
      try {
        const releases = await listAllReleasesWithEditions()
        return { content: [{ type: 'text', text: JSON.stringify(releases, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_get_release',
    'Получить релиз по ID со списком его изданий. Возвращает объект release + массив editions.',
    {
      id: z.string().describe('UUID релиза'),
    },
    async ({ id }) => {
      try {
        const release = await fetchReleaseById(id)
        if (!release) {
          return { content: [{ type: 'text', text: `Релиз с id="${id}" не найден` }], isError: true }
        }
        const editions = await fetchEditionsByRelease(id)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ ...release, editions }, null, 2),
          }],
        }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_create_release',
    'Создать новый релиз. slug генерируется автоматически, если не передан. authors — JSON-массив [{name, role}]. Возвращает созданный объект.',
    {
      title: z.string().describe('Название релиза'),
      slug: z.string().optional().describe('Slug (генерируется из title, если не передан)'),
      description: z.string().optional().describe('Описание'),
      genre: z.string().optional().describe('Жанр'),
      release_date: z.string().optional().describe('Дата релиза (YYYY-MM-DD)'),
      isbn: z.string().optional().describe('ISBN'),
      authors: z.array(z.object({ name: z.string(), role: z.string() })).optional().describe('Авторы'),
      annotation: z.string().optional().describe('Аннотация'),
      editor_notes: z.string().optional().describe('Редакторские заметки'),
      status: z.enum(['draft', 'published', 'archived']).optional().describe('Статус (по умолчанию draft)'),
    },
    async (data) => {
      try {
        const release = await createRelease(data)
        return { content: [{ type: 'text', text: JSON.stringify(release, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_update_release',
    'Обновить релиз целиком. ОБЯЗАТЕЛЬНО сначала вызвать canfly_get_release. Возвращает обновлённый объект.',
    {
      id: z.string().describe('UUID релиза'),
      title: z.string().describe('Название'),
      slug: z.string().describe('Slug'),
      description: z.string().nullable().optional().describe('Описание'),
      genre: z.string().nullable().optional().describe('Жанр'),
      release_date: z.string().nullable().optional().describe('Дата релиза (YYYY-MM-DD)'),
      isbn: z.string().nullable().optional().describe('ISBN'),
      authors: z.array(z.object({ name: z.string(), role: z.string() })).optional().describe('Авторы'),
      annotation: z.string().nullable().optional().describe('Аннотация'),
      editor_notes: z.string().nullable().optional().describe('Редакторские заметки'),
      status: z.enum(['draft', 'published', 'archived']).optional().describe('Статус'),
      cover_image: z.string().nullable().optional().describe('URL обложки'),
    },
    async ({ id, ...data }) => {
      try {
        const release = await updateRelease(id, data)
        if (!release) {
          return { content: [{ type: 'text', text: `Релиз с id="${id}" не найден` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(release, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_set_release_status',
    'Точечно изменить статус релиза (draft/published/archived). Не требует полной перезаписи.',
    {
      id: z.string().describe('UUID релиза'),
      status: z.enum(['draft', 'published', 'archived']).describe('Новый статус'),
    },
    async ({ id, status }) => {
      try {
        const release = await updateReleaseStatus(id, status)
        if (!release) {
          return { content: [{ type: 'text', text: `Релиз с id="${id}" не найден` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(release, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_get_edition',
    'Получить одно издание по ID (формат, tier, статус, slug).',
    {
      id: z.string().describe('UUID издания'),
    },
    async ({ id }) => {
      try {
        const edition = await fetchEditionById(id)
        if (!edition) {
          return { content: [{ type: 'text', text: `Издание с id="${id}" не найдено` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(edition, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_create_edition',
    'Добавить формат (book/comic/audiobook/audiorelease/album/magazine/digital) к релизу. slug генерируется автоматически. Возвращает созданное издание.',
    {
      release_id: z.string().describe('UUID релиза'),
      format: z.enum(['book', 'comic', 'audiobook', 'audiorelease', 'album', 'magazine', 'digital']).optional().describe('Формат (по умолчанию book)'),
      platform: z.string().optional().describe('Платформа'),
      quality_tier: z.enum(['draft', 'standard', 'premium']).optional().describe('Качество (по умолчанию standard)'),
      status: z.enum(['draft', 'published', 'archived']).optional().describe('Статус (по умолчанию draft)'),
      is_primary: z.boolean().optional().describe('Основное издание'),
    },
    async (data) => {
      try {
        const edition = await createEdition(data)
        return { content: [{ type: 'text', text: JSON.stringify(edition, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )
}
