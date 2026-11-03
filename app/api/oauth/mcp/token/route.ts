import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { exchangeMcpToken, hashMcpClientIp, mcpOAuthConfig } from '@/lib/server/mcp-oauth'
import { oauthError, oauthJson, readOAuthBody } from '@/lib/server/mcp-oauth-http'
import { mcpTokenSchema } from '@/lib/schemas/mcp-oauth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const config = mcpOAuthConfig()
  if (!config) {
    return oauthError('not_found', 'MCP OAuth is not enabled', 404)
  }

  const subject = hashMcpClientIp(request) ?? 'unknown'
  const limited = await checkRateLimit({
    bucket: 'mcp-oauth-token',
    subject,
    limit: 60,
    windowSeconds: 60,
  })
  if (!limited.allowed) return rateLimitResponse(limited)

  const body = await readOAuthBody(request)
  if (!body) {
    return oauthError('invalid_request', 'Ожидается application/x-www-form-urlencoded')
  }

  const parsed = mcpTokenSchema.safeParse(body)
  if (!parsed.success) {
    return oauthError('invalid_request', parsed.error.issues[0]?.message ?? 'Некорректный запрос')
  }

  if (parsed.data.resource && parsed.data.resource !== config.resource) {
    return oauthError('invalid_target', 'resource не совпадает с MCP-сервером')
  }

  const tokens = await exchangeMcpToken(parsed.data)
  if (!tokens) {
    return oauthError('invalid_grant', 'Код, refresh-токен или PKCE недействительны')
  }

  return oauthJson(tokens)
}
