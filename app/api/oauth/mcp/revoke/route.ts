import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { hashMcpClientIp, mcpOAuthEnabled, revokeMcpOAuthToken } from '@/lib/server/mcp-oauth'
import { oauthError, oauthJson, readOAuthBody } from '@/lib/server/mcp-oauth-http'
import { mcpRevocationSchema } from '@/lib/schemas/mcp-oauth'

export const dynamic = 'force-dynamic'

/**
 * RFC 7009: даже неизвестный или уже отозванный токен получает 200, иначе
 * клиент не сможет корректно завершить локальный logout.
 */
export async function POST(request: Request) {
  if (!mcpOAuthEnabled()) {
    return oauthError('not_found', 'MCP OAuth is not enabled', 404)
  }

  const subject = hashMcpClientIp(request) ?? 'unknown'
  const limited = await checkRateLimit({
    bucket: 'mcp-oauth-revoke',
    subject,
    limit: 30,
    windowSeconds: 60,
  })
  if (!limited.allowed) return rateLimitResponse(limited)

  const body = await readOAuthBody(request)
  if (body) {
    const parsed = mcpRevocationSchema.safeParse(body)
    if (parsed.success) {
      await revokeMcpOAuthToken(parsed.data.token, parsed.data.client_id)
    }
  }

  return oauthJson({ ok: true })
}
