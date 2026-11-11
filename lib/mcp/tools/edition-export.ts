import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import { fetchEditionById } from '@/lib/server/editions'
import { fetchReleaseById } from '@/lib/server/releases'
import { createEditionExportLink } from '@/lib/server/mcp-export-links'
import { json, notFound, toolError, withToolCatch } from '@/lib/mcp/tool-result'

export function registerEditionExportTools(server: McpServer) {
  server.registerTool(
    'canfly_export_edition',
    {
      title: 'Скачать издание: DOCX / Markdown',
      description:
        'Создать приватную временную ссылку на экспорт книги (все главы, включая черновики). Ссылка действует 5 минут, не кешируется. Поддерживает book; публичные ссылки опубликованных изданий не меняются.',
      inputSchema: z.object({
        edition_id: z.uuid().describe('UUID издания'),
        format: z.enum(['docx', 'md']).describe('Формат файла'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ edition_id, format }) => {
      const edition = await fetchEditionById(edition_id)
      if (!edition) return notFound('Издание', edition_id)
      if (edition.format !== 'book') return toolError('Для экспорта глав требуется издание формата book')
      const release = await fetchReleaseById(edition.release_id)
      if (!release) return notFound('Релиз', edition.release_id)
      const link = createEditionExportLink(edition.id, format)
      return json({
        ok: true,
        edition_id: edition.id,
        format,
        filename: `${edition.slug || edition.id}.${format}`,
        ...link,
      })
    }),
  )
}
