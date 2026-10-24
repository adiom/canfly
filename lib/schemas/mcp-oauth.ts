import { z } from 'zod'

export const MCP_CONTENT_SCOPE = 'canfly:content'

export function isMcpRedirectUri(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.hash) return false
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return true
    }
    return url.origin === 'https://chatgpt.com' && (
      url.pathname === '/connector_platform_oauth_redirect' ||
      /^\/connector\/oauth\/[a-zA-Z0-9_-]+$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

export const mcpClientSchema = z.object({
  client_name: z.string().trim().min(1).max(80).default('MCP client'),
  redirect_uris: z.array(z.string().max(2048).refine(isMcpRedirectUri)).min(1).max(8),
  token_endpoint_auth_method: z.literal('none').default('none'),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).min(1)
    .default(['authorization_code', 'refresh_token']),
  response_types: z.array(z.literal('code')).length(1).default(['code']),
})

export const mcpAuthorizationSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().uuid(),
  redirect_uri: z.string().max(2048).refine(isMcpRedirectUri),
  code_challenge: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url().max(2048),
  scope: z.literal(MCP_CONTENT_SCOPE).default(MCP_CONTENT_SCOPE),
  state: z.string().min(1).max(2048),
})

const tokenFields = {
  client_id: z.string().uuid(),
  resource: z.string().url().max(2048),
}

export const mcpTokenSchema = z.discriminatedUnion('grant_type', [
  z.object({
    ...tokenFields,
    grant_type: z.literal('authorization_code'),
    code: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
    redirect_uri: z.string().max(2048).refine(isMcpRedirectUri),
    code_verifier: z.string().regex(/^[a-zA-Z0-9._~-]{43,128}$/),
  }),
  z.object({
    ...tokenFields,
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().regex(/^cfrefresh_[a-zA-Z0-9_-]{43}$/),
    scope: z.literal(MCP_CONTENT_SCOPE).optional(),
  }),
])

export const mcpRevocationSchema = z.object({
  client_id: z.string().uuid(),
  token: z.string().min(1).max(128),
})

export type McpAuthorization = z.infer<typeof mcpAuthorizationSchema>
export type McpTokenRequest = z.infer<typeof mcpTokenSchema>
