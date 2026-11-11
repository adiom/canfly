import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import mammoth from 'mammoth'
import { Pool } from 'pg'

function tokenFromEnv(): string | undefined {
  if (process.env.MCP_TOKEN) return process.env.MCP_TOKEN
  for (const filename of ['.env.local', '.env']) {
    const file = join(process.cwd(), filename)
    if (!existsSync(file)) continue
    const match = readFileSync(file, 'utf8').match(/^MCP_TOKEN=(.+)$/m)
    if (match) return match[1].trim().replace(/^["']|["']$/g, '')
  }
}

const token = tokenFromEnv()
const editionId = process.env.MCP_E2E_TEST_EDITION_ID
const isolated = process.env.MCP_E2E_ISOLATED_DB === 'true'
const enabled = Boolean(token && editionId && isolated && process.env.DATABASE_URL)

type Rpc = {
  error?: { message: string }
  result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean }
}

async function parseRpc(response: APIResponse): Promise<Rpc> {
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = await response.text()
  if (response.headers()['content-type']?.includes('text/event-stream')) {
    const event = body.split(/\r?\n/).filter(line => line.startsWith('data:')).pop()
    if (!event) throw new Error('No JSON-RPC data event')
    return JSON.parse(event.slice(5).trim()) as Rpc
  }
  return JSON.parse(body) as Rpc
}

async function callTool(request: APIRequestContext, name: string, args: Record<string, unknown>) {
  const response = await request.post('/api/mcp', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream' },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    },
  })
  const rpc = await parseRpc(response)
  if (rpc.error || rpc.result?.isError) {
    throw new Error(`MCP ${name}: ${rpc.error?.message || rpc.result?.content?.[0]?.text}`)
  }
  const text = rpc.result?.content?.find(item => item.type === 'text')?.text
  if (!text) throw new Error(`MCP ${name} returned empty content`)
  return JSON.parse(text) as Record<string, any>
}

test.describe('MCP editorial roundtrip (isolated test DB only)', () => {
  test.skip(!enabled, 'Requires MCP_E2E_ISOLATED_DB=true, MCP_E2E_TEST_EDITION_ID, DATABASE_URL and MCP_TOKEN')

  test('draft chapter: create, read, edit, revision history and private exports', async ({ request }) => {
    const edition = await callTool(request, 'canfly_get_edition', { id: editionId })
    expect(edition.status).toBe('draft')
    expect(edition.format).toBe('book')

    const initial = '<p>— Маша, можно? 😊</p><p>Ветер стих.<br>Город N уснул.</p>'
    const revised = '<p>— Маша, можно? 😊</p><p>Снова дождь.<br>И снова дорога.</p>'
    let createdId: string | undefined
    let initialStored = ''
    try {
      const created = await callTool(request, 'canfly_create_chapter', {
        edition_id: editionId,
        title: 'MCP editorial E2E',
        chapter_index: 99999,
        content: initial,
      })
      expect(created.ok).toBe(true)
      expect(created).not.toHaveProperty('content')
      createdId = created.id as string

      async function getAllText() {
        let offset = 0
        let content = ''
        let digest: string | undefined
        for (let i = 0; i < 1000; i++) {
          const page = await callTool(request, 'canfly_get_chapter', { id: createdId, offset, limit: 7 })
          if (digest) expect(page.content_hash).toBe(digest)
          digest = page.content_hash
          content += page.content
          if (page.next_offset === null) return content
          offset = page.next_offset
        }
        throw new Error('Too many chapter pages')
      }

      initialStored = await getAllText()
      expect(initialStored).toContain('Маша, можно? 😊')
      expect(initialStored).toContain('Город N уснул.')
      const updated = await callTool(request, 'canfly_update_chapter', {
        id: createdId,
        content: revised,
      })
      expect(updated.ok).toBe(true)
      expect(updated).not.toHaveProperty('content')
      const updatedStored = await getAllText()
      expect(updatedStored).toContain('Снова дождь.')
      expect(updatedStored).not.toBe(initialStored)

      const versions = await callTool(request, 'canfly_list_chapter_versions', { chapter_id: createdId })
      expect(versions.some((version: { content: string }) => version.content === initialStored)).toBe(true)

      for (const format of ['md', 'docx'] as const) {
        const exportResult = await callTool(request, 'canfly_export_edition', {
          edition_id: editionId,
          format,
        })
        expect(exportResult.ok).toBe(true)
        const signedUrl = new URL(exportResult.url as string)
        // Test server uses local baseURL even when NEXT_PUBLIC_BASE_URL differs.
        const download = await request.get(signedUrl.pathname + signedUrl.search)
        expect(download.status()).toBe(200)
        expect(download.headers()['cache-control']).toContain('no-store')
        if (format === 'md') {
          expect(await download.text()).toContain('Снова дождь.')
        } else {
          const docx = Buffer.from(await download.body())
          const extracted = await mammoth.extractRawText({ buffer: docx })
          expect(extracted.value).toContain('Снова дождь.')
        }
      }
    } finally {
      // Cleanup is intentionally via the server layer and only when explicitly opted into a test DB.
      if (createdId) {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL })
        try {
          await pool.query('DELETE FROM chapter_versions WHERE chapter_id = $1', [createdId])
          await pool.query('DELETE FROM chapters WHERE id = $1 AND edition_id = $2', [createdId, editionId])
        } finally {
          await pool.end()
        }
      }
    }
  })
})
