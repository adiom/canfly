import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'

/**
 * Контракт MCP-сервера: handshake, полный список тулов и защита write-тулов.
 * Нужен статический MCP_TOKEN; при OAuth-only окружении тест пропускается.
 */

interface JsonRpcResponse {
  jsonrpc: string
  id?: number
  result?: {
    serverInfo?: { name: string }
    tools?: Array<{ name: string }>
  }
  error?: { code: number; message: string }
}

function readEnvToken(): string | undefined {
  if (process.env.MCP_TOKEN) return process.env.MCP_TOKEN

  for (const file of ['.env.local', '.env']) {
    const path = join(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line.startsWith('MCP_TOKEN=')) continue
      const value = line.slice('MCP_TOKEN='.length).trim().replace(/^["']|["']$/g, '')
      if (value) return value
    }
  }
  return undefined
}

const token = readEnvToken()

async function parseRpc(res: APIResponse): Promise<JsonRpcResponse> {
  expect(res.ok(), await res.text()).toBeTruthy()
  const text = await res.text()

  if ((res.headers()['content-type'] ?? '').includes('text/event-stream')) {
    const lines = text.split(/\r?\n/).filter((line) => line.startsWith('data:'))
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i].slice('data:'.length).trim()) as JsonRpcResponse
      } catch {
        // Пропускаем служебные SSE-события без JSON.
      }
    }
    throw new Error('SSE-ответ не содержит JSON-RPC')
  }

  return JSON.parse(text) as JsonRpcResponse
}

async function rpc(
  request: APIRequestContext,
  payload: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const res = await request.post('/api/mcp', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
    },
    data: payload,
    failOnStatusCode: false,
  })
  return parseRpc(res)
}

test.describe('MCP tools', () => {
  test.skip(!token, 'MCP_TOKEN не задан — OAuth-only окружение')

  test('handshake и tools/list отдают зарегистрированные тулы', async ({ request }) => {
    const init = await rpc(request, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'canfly-e2e', version: '1.0.0' },
      },
    })

    expect(init.result?.serverInfo?.name).toBe('canfly')

    const list = await rpc(request, { jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const names = (list.result?.tools ?? []).map((tool) => tool.name)

    expect(names).toEqual(expect.arrayContaining([
      'canfly_list_releases',
      'canfly_update_edition',
      'canfly_reorder_chapters',
      'canfly_restore_chapter_version',
      'canfly_create_series',
      'canfly_set_release_series',
      'canfly_set_character_places',
      'canfly_search',
    ]))

    // Никаких новых удалений релизов, изданий, глав, персонажей и серий.
    expect(names).not.toContain('canfly_delete_release')
    expect(names).not.toContain('canfly_delete_edition')
    expect(names).not.toContain('canfly_delete_chapter')
    expect(names).not.toContain('canfly_delete_character')
    expect(names).not.toContain('canfly_delete_series')
  })

  test('неизвестный тул возвращает ошибку, а не падение сервера', async ({ request }) => {
    const response = await rpc(request, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'canfly_does_not_exist', arguments: {} },
    })

    expect(response.error ?? response.result).toBeTruthy()
  })
})
