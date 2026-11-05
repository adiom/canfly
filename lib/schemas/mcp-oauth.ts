import { z } from 'zod'

export const MCP_CONTENT_SCOPE = 'canfly:content'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Дополнительные точные redirect URI из env — для нестандартных клиентов. */
export function mcpExtraRedirectUris(): string[] {
  return (process.env.MCP_OAUTH_EXTRA_REDIRECT_URIS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.hash) return null
    return url
  } catch {
    return null
  }
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase())
}

/** Синтаксически корректный redirect URI без привязки к нашему allowlist. */
export function isWellFormedRedirectUri(value: string): boolean {
  const url = parseHttpUrl(value)
  if (!url) return false
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && isLoopbackHost(url.hostname)
}

/**
 * Allowlist callback-адресов. Для ChatGPT и Claude закреплены origin и форма
 * пути, для локальных клиентов (Cursor, OpenCode, mcp-remote) разрешён любой
 * loopback-порт. Всё остальное — только точным значением из env.
 */
export function isMcpRedirectUri(value: string): boolean {
  const url = parseHttpUrl(value)
  if (!url) return false

  if (url.protocol === 'http:') {
    return isLoopbackHost(url.hostname)
  }
  if (url.protocol !== 'https:') return false

  const hostname = url.hostname.toLowerCase()

  if (hostname === 'chatgpt.com') {
    return (
      url.pathname === '/connector_platform_oauth_redirect' ||
      /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(url.pathname)
    )
  }

  if (hostname === 'chat.openai.com') {
    return /^\/aip\/[A-Za-z0-9_-]+\/oauth\/callback$/.test(url.pathname)
  }

  if (hostname === 'claude.ai' || hostname === 'claude.com') {
    return url.pathname.startsWith('/api/mcp/')
  }

  return mcpExtraRedirectUris().includes(value)
}

/**
 * client_id — либо UUID зарегистрированного DCR-клиента, либо HTTPS-URL
 * Client ID Metadata Document. URL не должен содержать userinfo и fragment.
 */
export function isMcpClientId(value: string): boolean {
  if (z.string().uuid().safeParse(value).success) return true
  const url = parseHttpUrl(value)
  return !!url && url.protocol === 'https:'
}

export const mcpClientIdSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(isMcpClientId, 'client_id должен быть UUID или HTTPS-URL')

export const mcpClientSchema = z.object({
  client_name: z.string().trim().min(1).max(120).default('MCP client'),
  redirect_uris: z.array(z.string().max(2048).refine(isMcpRedirectUri)).min(1).max(8),
  token_endpoint_auth_method: z.literal('none').default('none'),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).min(1)
    .default(['authorization_code', 'refresh_token']),
  response_types: z.array(z.literal('code')).length(1).default(['code']),
  client_uri: z.string().url().max(2048).optional(),
  logo_uri: z.string().url().max(2048).optional(),
})

/**
 * Документ CIMD. Redirect URI проверяются только синтаксически: клиент может
 * иметь callback'и и для других серверов. Наш allowlist проверяется отдельно
 * для того redirect_uri, который пришёл в authorize.
 */
export const mcpClientMetadataSchema = z.object({
  client_id: z.string().max(2048),
  client_name: z.string().trim().min(1).max(120).optional(),
  redirect_uris: z.array(z.string().max(2048).refine(isWellFormedRedirectUri)).min(1).max(32),
  token_endpoint_auth_method: z.string().max(64).optional(),
  token_endpoint_auth_methods_supported: z.array(z.string().max(64)).min(1).max(8).optional(),
  client_uri: z.string().url().max(2048).optional(),
  logo_uri: z.string().url().max(2048).optional(),
  grant_types: z.array(z.string().max(64)).max(8).optional(),
  response_types: z.array(z.string().max(64)).max(8).optional(),
})

export const mcpAuthorizationSchema = z.object({
  response_type: z.literal('code'),
  client_id: mcpClientIdSchema,
  redirect_uri: z.string().max(2048).refine(isMcpRedirectUri),
  code_challenge: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url().max(2048).optional(),
  scope: z.string().max(200).optional(),
  state: z.string().min(1).max(2048),
})

const tokenFields = {
  client_id: mcpClientIdSchema,
  resource: z.string().url().max(2048).optional(),
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
  client_id: mcpClientIdSchema.optional(),
  token: z.string().min(1).max(256),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
})

/** Подписанный запрос согласия: те же параметры + срок жизни подписи. */
export const mcpSignedAuthorizationSchema = mcpAuthorizationSchema.extend({
  exp: z.number().int().positive(),
})

export type McpAuthorization = z.infer<typeof mcpAuthorizationSchema>
export type McpSignedAuthorization = z.infer<typeof mcpSignedAuthorizationSchema>
export type McpTokenRequest = z.infer<typeof mcpTokenSchema>
export type McpClientRegistration = z.infer<typeof mcpClientSchema>
