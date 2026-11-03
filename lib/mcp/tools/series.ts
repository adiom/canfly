import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  createSeries,
  fetchAllSeriesWithStats,
  fetchSeriesById,
  fetchSeriesWithReleases,
  updateSeries,
} from '@/lib/server/series'
import { json, notFound, toolError, withToolCatch } from '@/lib/mcp/tool-result'

const uuid = z.uuid()

export function registerSeriesTools(server: McpServer) {
  server.registerTool(
    'canfly_list_series',
    {
      title: 'Список серий',
      description:
        'Серии вселенной canfly с количеством опубликованных релизов и обложкой. Возвращает id, title, slug, description, release_count, cover_image.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(100).describe('Сколько вернуть'),
        offset: z.number().int().min(0).default(0).describe('Сдвиг'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ limit, offset }) => {
      const all = await fetchAllSeriesWithStats()
      return json({
        total: all.length,
        items: all.slice(offset, offset + limit),
      })
    }),
  )

  server.registerTool(
    'canfly_get_series',
    {
      title: 'Серия по ID или slug',
      description:
        'Серия по UUID или slug. Для slug возвращает опубликованные релизы серии с phase_number.',
      inputSchema: z.object({
        id: uuid.optional().describe('UUID серии (либо id, либо slug)'),
        slug: z.string().optional().describe('Slug серии (либо id, либо slug)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ id, slug }) => {
      if (id) {
        const series = await fetchSeriesById(id)
        return series ? json(series) : notFound('Серия', id)
      }
      if (slug) {
        const series = await fetchSeriesWithReleases(slug)
        return series ? json(series) : toolError(`Серия со slug="${slug}" не найдена`)
      }
      return toolError('Нужно указать id или slug')
    }),
  )

  server.registerTool(
    'canfly_create_series',
    {
      title: 'Создать серию',
      description: 'Создать серию. slug должен быть уникальным.',
      inputSchema: z.object({
        title: z.string().min(1).describe('Название серии'),
        slug: z.string().min(1).describe('Уникальный URL-friendly slug'),
        description: z.string().nullable().optional().describe('Описание'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    withToolCatch(async (data) => json(await createSeries(data))),
  )

  server.registerTool(
    'canfly_update_series',
    {
      title: 'Обновить серию',
      description:
        'Обновить серию. Апдейт частичный: непереданные поля сохраняют текущее значение.',
      inputSchema: z.object({
        id: uuid.describe('UUID серии'),
        title: z.string().min(1).optional().describe('Название'),
        slug: z.string().min(1).optional().describe('Slug'),
        description: z.string().nullable().optional().describe('Описание'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ id, ...data }) => {
      const current = await fetchSeriesById(id)
      if (!current) return notFound('Серия', id)

      const updated = await updateSeries(id, {
        title: data.title ?? current.title,
        slug: data.slug ?? current.slug,
        description: data.description !== undefined ? data.description : current.description,
      })
      return updated ? json(updated) : notFound('Серия', id)
    }),
  )
}
