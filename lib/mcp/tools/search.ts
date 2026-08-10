import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import { searchAll } from '@/lib/server/search'
import { json } from '@/lib/mcp/tool-result'

export function registerSearchTools(server: McpServer) {
  server.registerTool(
    'canfly_search',
    {
      title: 'Поиск по canfly',
      description:
        'Полнотекстовый поиск по опубликованным релизам, персонажам и новостям canfly.org. Возвращает объект { releases[], characters[], news[], total, query }.',
      inputSchema: z.object({
        query: z.string().min(2).describe('Поисковый запрос (минимум 2 символа)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => json(await searchAll(query)),
  )
}
