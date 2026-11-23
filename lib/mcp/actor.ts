import type { AuthInfo, ServerContext } from '@modelcontextprotocol/server'
import type { ChapterLeaseActor } from '@/lib/server/chapter-leases'

/**
 * mcp-handler передаёт проверенный `request.auth` в transport как `authInfo`;
 * SDK кладёт его в `ctx.http.authInfo`. Fallback на `ctx.http.req.auth`
 * оставлен для версий SDK, которые сохраняют исходный Request.
 */
export function mcpAuthInfo(ctx?: ServerContext): AuthInfo | undefined {
  const http = ctx?.http as { authInfo?: AuthInfo } | undefined
  return http?.authInfo ?? ctx?.http?.req?.auth
}

/** MCP пишет от имени администратора; статический MCP_TOKEN не даёт user_id. */
export function mcpActor(ctx?: ServerContext): ChapterLeaseActor {
  const userId = mcpAuthInfo(ctx)?.extra?.userId
  return { userId: typeof userId === 'string' ? userId : null, actorKind: 'mcp' }
}
