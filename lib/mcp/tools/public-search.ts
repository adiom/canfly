import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import { dbQuery } from '@/lib/db'
import { json } from '@/lib/mcp/tool-result'

type PublicSearchRow = {
  kind: 'release' | 'news'
  id: string
  title: string
  slug: string
  category: string | null
  snippet: string | null
}

/**
 * Public MCP search intentionally exposes only records whose publication
 * status is explicit in the database. Character search is excluded until
 * the character publication/visibility policy can be enforced in SQL.
 */
export function registerPublicSearchTools(server: McpServer) {
  server.registerTool(
    'canfly_public_search',
    {
      title: 'Поиск по опубликованному контенту Canfly',
      description:
        'Безопасный публичный поиск только по опубликованным релизам и новостям Canfly. Не ищет персонажей, черновики или приватные материалы. Возвращает до 30 совпадений с заголовком, slug и коротким фрагментом.',
      inputSchema: z.object({
        query: z.string().trim().min(2).max(200).describe('Поисковый запрос, от 2 до 200 символов'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      const normalized = query.trim()
      if (normalized.length < 2) {
        return json({ query: normalized, total: 0, results: [] })
      }

      // position() treats user input literally, unlike LIKE patterns, so
      // percent and underscore characters cannot accidentally widen a search.
      const results = await dbQuery<PublicSearchRow>(
        `
        SELECT *
        FROM (
          SELECT
            'release'::text AS kind,
            id::text AS id,
            title,
            slug,
            genre AS category,
            LEFT(COALESCE(annotation, description), 180) AS snippet
          FROM releases
          WHERE status = 'published'
            AND (
              POSITION(LOWER($1) IN LOWER(title)) > 0
              OR POSITION(LOWER($1) IN LOWER(COALESCE(annotation, ''))) > 0
              OR POSITION(LOWER($1) IN LOWER(COALESCE(description, ''))) > 0
              OR POSITION(LOWER($1) IN LOWER(COALESCE(genre, ''))) > 0
            )

          UNION ALL

          SELECT
            'news'::text AS kind,
            id::text AS id,
            title,
            slug,
            section AS category,
            LEFT(content, 180) AS snippet
          FROM news_posts
          WHERE status = 'published'
            AND (
              POSITION(LOWER($1) IN LOWER(title)) > 0
              OR POSITION(LOWER($1) IN LOWER(COALESCE(content, ''))) > 0
              OR POSITION(LOWER($1) IN LOWER(COALESCE(tag, ''))) > 0
              OR POSITION(LOWER($1) IN LOWER(COALESCE(section, ''))) > 0
            )
        ) AS published_content
        ORDER BY title ASC
        LIMIT 30
        `,
        [normalized],
      )

      return json({ query: normalized, total: results.length, results })
    },
  )
}
