import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { searchAll } from '@/lib/server/search'

export function registerSearchTools(server: McpServer) {
  server.tool(
    'canfly_search',
    'Полнотекстовый поиск по опубликованным релизам, персонажам и новостям canfly.org. Возвращает объект { releases[], characters[], news[], total, query }.',
    {
      query: z.string().min(2).describe('Поисковый запрос (минимум 2 символа)'),
    },
    async ({ query }) => {
      try {
        const results = await searchAll(query)
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )
}
