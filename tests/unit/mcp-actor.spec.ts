import { expect, test } from '@playwright/test'
import type { ServerContext } from '@modelcontextprotocol/server'
import { mcpActor, mcpAuthInfo } from '@/lib/mcp/actor'

function context(http: unknown): ServerContext {
  return { http } as unknown as ServerContext
}

test('reads the OAuth user from ctx.http.authInfo', () => {
  const auth = { token: 't', clientId: 'c', scopes: [], extra: { userId: 'user-1' } }
  expect(mcpAuthInfo(context({ authInfo: auth }))).toBe(auth)
  expect(mcpActor(context({ authInfo: auth }))).toEqual({ userId: 'user-1', actorKind: 'mcp' })
})

test('falls back to the original request auth', () => {
  const auth = { token: 't', clientId: 'c', scopes: [], extra: { userId: 'user-2' } }
  const request = Object.assign(new Request('http://localhost/api/mcp'), { auth })
  expect(mcpActor(context({ req: request }))).toEqual({ userId: 'user-2', actorKind: 'mcp' })
})

test('static MCP tokens have no user but keep the mcp actor kind', () => {
  expect(mcpActor(context({ authInfo: { token: 't', clientId: 'static', scopes: [] } })))
    .toEqual({ userId: null, actorKind: 'mcp' })
  expect(mcpActor(undefined)).toEqual({ userId: null, actorKind: 'mcp' })
})
