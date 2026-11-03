import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import { searchAll } from '@/lib/server/search'
import { json, withToolCatch } from '@/lib/mcp/tool-result'

export function registerSearchTools(server: McpServer) {
  server.registerTool(
    'canfly_search',
    {
      title: 'Поиск по canfly',
      description:
        'Полнотекстовый поиск по опубликованным релизам, персонажам и новостям canfly.org. Возвращает { releases[], characters[], news[], total, has_more, limit, offset, query }. total — общее число совпадений до пагинации.',
      inputSchema: z.object({
        query: z.string().min(2).describe('Поисковый запрос (минимум 2 символа)'),
        limit: z.number().int().min(1).max(50).default(20).describe('Сколько вернуть'),
        offset: z.number().int().min(0).default(0).describe('Сдвиг для постраничного обхода'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ query, limit, offset }) => json(await searchAll(query, { limit, offset }))),
  )
}
