import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import {
  hashMcpClientIp,
  mcpOAuthEnabled,
  registerMcpClient,
} from '@/lib/server/mcp-oauth'
import { oauthError, oauthJson } from '@/lib/server/mcp-oauth-http'

export const dynamic = 'force-dynamic'

/** Dynamic Client Registration (RFC 7591). */
export async function POST(request: Request) {
  if (!mcpOAuthEnabled()) {
    return oauthError('not_found', 'MCP OAuth is not enabled', 404)
  }

  const subject = hashMcpClientIp(request) ?? 'unknown'
  const limited = await checkRateLimit({
    bucket: 'mcp-oauth-register',
    subject,
    limit: 10,
    windowSeconds: 3600,
  })
  if (!limited.allowed) return rateLimitResponse(limited)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return oauthError('invalid_client_metadata', 'Тело запроса должно быть JSON')
  }

  const client = await registerMcpClient(body)
  if (!client) {
    return oauthError('invalid_client_metadata', 'Некорректные метаданные клиента')
  }

  return oauthJson(client, 201)
}
