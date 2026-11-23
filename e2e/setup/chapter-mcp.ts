import { expect } from '@playwright/test'
import { createMcpHandler } from 'mcp-handler'
import { registerChaptersTools } from '@/lib/mcp/tools/chapters'

const handler = createMcpHandler(registerChaptersTools)

export async function callChapterMcp(name: string, args: object) {
  const response = await handler(new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args },
    }),
  }))
  const body = await response.text()
  const data = body.split('\n').find(line => line.startsWith('data: '))?.slice(6) ?? body
  expect(response.status, body).toBe(200)
  const rpc = JSON.parse(data) as {
    result?: { isError?: boolean; content: { text: string }[]; structuredContent?: unknown }
  }
  if (!rpc.result) throw new Error(`MCP ${name}: ${data}`)
  return rpc.result
}
