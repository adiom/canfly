import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import { revalidatePath } from 'next/cache'
import { dbQueryOne } from '@/lib/db'
import { sanitizeChapterHtml } from '@/lib/sanitize'
import { generateUniqueNewsSlug } from '@/lib/server/news'
import { json, toolError, withToolCatch } from '@/lib/mcp/tool-result'

const statusSchema = z.enum(['draft', 'published'])
const schema = z.object({
  title: z.string().trim().min(1).max(300).describe('Заголовок новости'),
  section: z.string().trim().min(1).max(100).default('разработка').describe('Раздел, например разработка'),
  tag: z.string().trim().max(100).nullable().optional().describe('Необязательный тег'),
  content: z.string().max(200_000).describe('HTML-содержимое новости, очищается на сервере'),
  cover_image: z.string().max(2048).nullable().optional().describe('URL обложки'),
  status: statusSchema.default('draft').describe('Черновик по умолчанию; published для публикации'),
})

export function registerNewsTools(server: McpServer) {
  server.registerTool(
    'canfly_create_news',
    {
      title: 'Создать новость',
      description: 'Создаёт черновик новости Canfly или публикует её при status=published. HTML очищается, slug подбирается автоматически. Доступен только авторизованному администратору MCP.',
      inputSchema: schema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    withToolCatch(async ({ title, section, tag, content, cover_image, status }) => {
      // MCP itself is admin-only; the caller has no Studio cookie. A null author
      // makes the entry editable by Studio admins, not by unrelated authors.
      const safeContent = sanitizeChapterHtml(content)
      for (let attempt = 0; attempt < 5; attempt++) {
        const slug = await generateUniqueNewsSlug(title)
        const post = await dbQueryOne<{ id: string; slug: string; status: string }>(
          `INSERT INTO news_posts
             (title, section, tag, content, cover_image, slug, status,
              is_active, published_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                   CASE WHEN $7 = 'published' THEN NOW() ELSE NULL END, NOW())
           ON CONFLICT (slug) DO NOTHING
           RETURNING id::text, slug, status`,
          [title, section, tag ?? null, safeContent, cover_image ?? null,
           slug, status, status === 'published'],
        )
        if (!post) continue
        revalidatePath('/news')
        revalidatePath('/studio/news')
        revalidatePath(`/news/${post.slug}`)
        return json({ ...post, url: `https://canfly.org/news/${post.slug}` })
      }
      return toolError('Не удалось подобрать уникальный slug. Повторите запрос.')
    }),
  )
}
