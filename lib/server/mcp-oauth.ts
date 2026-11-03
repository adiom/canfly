import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import {
  MCP_CONTENT_SCOPE,
  mcpAuthorizationSchema,
  mcpClientMetadataSchema,
  mcpClientSchema,
  mcpSignedAuthorizationSchema,
  type McpAuthorization,
  type McpClientRegistration,
  type McpSignedAuthorization,
  type McpTokenRequest,
} from '@/lib/schemas/mcp-oauth'

export interface McpOAuthConfig {
  issuer: string
  resource: string
  resourceMetadataUrl: string
  emails: string[]
  metadataHosts: string[]
}

export interface McpOAuthClient {
  /** UUID строки в mcp_oauth_clients — на него ссылаются коды и гранты. */
  id: string
  /** Значение, которое клиент присылает в client_id: UUID или HTTPS-URL. */
  clientId: string
  name: string
  redirectUris: string[]
  clientUri: string | null
  logoUri: string | null
}

export type McpOAuthEvent =
  | 'client_registered'
  | 'authorize_denied'
  | 'code_issued'
  | 'token_issued'
  | 'token_refreshed'
  | 'refresh_reuse'
  | 'token_revoked'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CIMD_TTL_MS = 10 * 60 * 1000
const CIMD_MAX_BYTES = 64 * 1024
const CIMD_TIMEOUT_MS = 5_000

const DEFAULT_METADATA_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'claude.com',
  'localhost',
  '127.0.0.1',
  '[::1]',
]

const cimdCache = new Map<string, {
  expiresAt: number
  metadata: {
    clientName: string
    redirectUris: string[]
    clientUri: string | null
    logoUri: string | null
  }
}>()

function splitEnv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function mcpOAuthConfig(): McpOAuthConfig | null {
  // Подпись запроса согласия и хеширование — на AUTH_SECRET. Без него OAuth
  // не включаем, чтобы не выпускать токены с предсказуемым ключом.
  if (!process.env.AUTH_SECRET) return null

  const base = process.env.NEXT_PUBLIC_BASE_URL
  if (!base) return null

  try {
    const url = new URL(base)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null

    const issuer = url.origin
    const emails = splitEnv('MCP_OAUTH_ALLOWED_EMAILS').map((email) => email.toLowerCase())
    const configuredHosts = splitEnv('MCP_OAUTH_CLIENT_METADATA_HOSTS').map((host) => host.toLowerCase())
    const metadataHosts = configuredHosts.length > 0 ? configuredHosts : DEFAULT_METADATA_HOSTS

    return {
      issuer,
      resource: `${issuer}/api/mcp`,
      resourceMetadataUrl: `${issuer}/.well-known/oauth-protected-resource/api/mcp`,
      emails,
      metadataHosts,
    }
  } catch {
    return null
  }
}

export function mcpOAuthEnabled(): boolean {
  return !!mcpOAuthConfig()?.emails.length
}

export function mcpOAuthUserAllowed(user: { email: string | null; is_admin: boolean }): boolean {
  const config = mcpOAuthConfig()
  return !!config && user.is_admin && !!user.email &&
    config.emails.includes(user.email.toLowerCase())
}

export function hashMcpSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function mcpPkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function secretEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

export function mcpProtectedResourceMetadata() {
  const config = mcpOAuthConfig()
  if (!config?.emails.length) return null
  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: [MCP_CONTENT_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Canfly content',
  }
}

export function mcpAuthorizationServerMetadata() {
  const config = mcpOAuthConfig()
  if (!config?.emails.length) return null
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/mcp/authorize`,
    token_endpoint: `${config.issuer}/api/oauth/mcp/token`,
    registration_endpoint: `${config.issuer}/api/oauth/mcp/register`,
    revocation_endpoint: `${config.issuer}/api/oauth/mcp/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: [MCP_CONTENT_SCOPE],
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
  }
}

function mapClientRow(row: {
  id: string
  client_name: string
  redirect_uris: string[]
  client_id_url: string | null
  client_uri: string | null
  logo_uri: string | null
}): McpOAuthClient {
  return {
    id: row.id,
    clientId: row.client_id_url ?? row.id,
    name: row.client_name,
    redirectUris: row.redirect_uris,
    clientUri: row.client_uri,
    logoUri: row.logo_uri,
  }
}

async function loadCimdMetadata(clientId: string): Promise<McpOAuthClient | null> {
  const config = mcpOAuthConfig()
  if (!config) return null

  let url: URL
  try {
    url = new URL(clientId)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null
  if (!config.metadataHosts.includes(url.hostname.toLowerCase())) return null

  const cached = cimdCache.get(clientId)
  if (cached && cached.expiresAt > Date.now()) {
    return upsertCimdClient(clientId, cached.metadata)
  }

  try {
    const response = await fetch(clientId, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(CIMD_TIMEOUT_MS),
    })
    if (!response.ok) return null
    if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('json')) return null

    const declaredLength = Number(response.headers.get('content-length') ?? '0')
    if (declaredLength > CIMD_MAX_BYTES) return null

    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > CIMD_MAX_BYTES) return null

    const parsed = mcpClientMetadataSchema.safeParse(JSON.parse(text))
    if (!parsed.success) return null
    if (parsed.data.client_id !== clientId) return null
    if (parsed.data.token_endpoint_auth_method && parsed.data.token_endpoint_auth_method !== 'none') return null
    if (parsed.data.grant_types && !parsed.data.grant_types.includes('authorization_code')) return null
    if (parsed.data.response_types && !parsed.data.response_types.includes('code')) return null

    const metadata = {
      clientName: parsed.data.client_name ?? url.hostname,
      redirectUris: parsed.data.redirect_uris,
      clientUri: parsed.data.client_uri ?? null,
      logoUri: parsed.data.logo_uri ?? null,
    }
    cimdCache.set(clientId, { expiresAt: Date.now() + CIMD_TTL_MS, metadata })
    return upsertCimdClient(clientId, metadata)
  } catch {
    return null
  }
}

async function upsertCimdClient(
  clientIdUrl: string,
  metadata: {
    clientName: string
    redirectUris: string[]
    clientUri: string | null
    logoUri: string | null
  },
): Promise<McpOAuthClient | null> {
  const row = await dbQueryOne<{
    id: string
    client_name: string
    redirect_uris: string[]
    client_id_url: string | null
    client_uri: string | null
    logo_uri: string | null
  }>(
    `INSERT INTO mcp_oauth_clients
       (client_name, redirect_uris, client_id_url, client_uri, logo_uri,
        token_endpoint_auth_method, metadata_fetched_at)
     VALUES ($1, $2, $3, $4, $5, 'none', NOW())
     ON CONFLICT (client_id_url) WHERE client_id_url IS NOT NULL DO UPDATE SET
       client_name = EXCLUDED.client_name,
       redirect_uris = EXCLUDED.redirect_uris,
       client_uri = EXCLUDED.client_uri,
       logo_uri = EXCLUDED.logo_uri,
       metadata_fetched_at = NOW()
     RETURNING id, client_name, redirect_uris, client_id_url, client_uri, logo_uri`,
    [
      metadata.clientName,
      [...new Set(metadata.redirectUris)],
      clientIdUrl,
      metadata.clientUri,
      metadata.logoUri,
    ],
  )
  return row ? mapClientRow(row) : null
}

/** Находит клиента по UUID (DCR) или по CIMD-URL. */
export async function resolveMcpClient(clientId: string): Promise<McpOAuthClient | null> {
  if (UUID_PATTERN.test(clientId)) {
    const row = await dbQueryOne<{
      id: string
      client_name: string
      redirect_uris: string[]
      client_id_url: string | null
      client_uri: string | null
      logo_uri: string | null
    }>(
      `SELECT id, client_name, redirect_uris, client_id_url, client_uri, logo_uri
       FROM mcp_oauth_clients WHERE id = $1 LIMIT 1`,
      [clientId],
    )
    return row ? mapClientRow(row) : null
  }

  return loadCimdMetadata(clientId)
}

export async function registerMcpClient(input: unknown) {
  if (!mcpOAuthEnabled()) return null
  const parsed = mcpClientSchema.safeParse(input)
  if (!parsed.success) return null

  const data: McpClientRegistration = parsed.data
  const row = await dbQueryOne<{ id: string; created_at: string }>(
    `INSERT INTO mcp_oauth_clients
       (client_name, redirect_uris, client_uri, logo_uri, token_endpoint_auth_method)
     VALUES ($1, $2, $3, $4, 'none')
     RETURNING id, created_at`,
    [
      data.client_name,
      [...new Set(data.redirect_uris)],
      data.client_uri ?? null,
      data.logo_uri ?? null,
    ],
  )
  if (!row) return null

  await logMcpOAuthEvent('client_registered', { clientId: row.id })

  return {
    ...data,
    client_id: row.id,
    client_id_issued_at: Math.floor(new Date(row.created_at).getTime() / 1000),
  }
}

export async function validateMcpAuthorization(input: unknown) {
  const parsed = mcpAuthorizationSchema.safeParse(input)
  const config = mcpOAuthConfig()
  if (!parsed.success || !config?.emails.length) return null

  const resource = parsed.data.resource ?? config.resource
  if (resource !== config.resource) return null

  const scope = parsed.data.scope ?? MCP_CONTENT_SCOPE
  if (scope !== MCP_CONTENT_SCOPE) return null

  const client = await resolveMcpClient(parsed.data.client_id)
  if (!client || !client.redirectUris.includes(parsed.data.redirect_uri)) return null

  return {
    request: { ...parsed.data, resource, scope: MCP_CONTENT_SCOPE } as McpAuthorization,
    client,
  }
}

export function mcpAuthorizationRedirect(
  request: McpAuthorization,
  response: { code: string } | { error: string; error_description?: string },
) {
  const config = mcpOAuthConfig()
  if (!config) throw new Error('MCP OAuth is not configured')
  const url = new URL(request.redirect_uri)
  for (const [key, value] of Object.entries(response)) {
    url.searchParams.set(key, value)
  }
  url.searchParams.set('state', request.state)
  url.searchParams.set('iss', config.issuer)
  return url.toString()
}

function signingKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  return createHash('sha256').update(`mcp-oauth-consent:${secret}`).digest()
}

/** Подписывает параметры authorize, чтобы форму согласия нельзя было подменить. */
export function signMcpAuthorizationRequest(
  request: McpAuthorization,
  ttlSeconds = 600,
): string | null {
  const key = signingKey()
  if (!key) return null
  const payload: McpSignedAuthorization = {
    ...request,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyMcpAuthorizationRequest(token: string): McpSignedAuthorization | null {
  const key = signingKey()
  if (!key) return null

  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = createHmac('sha256', key).update(body).digest()
  const provided = Buffer.from(signature, 'base64url')
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

  try {
    const parsed = mcpSignedAuthorizationSchema.safeParse(
      JSON.parse(Buffer.from(body, 'base64url').toString('utf8')),
    )
    if (!parsed.success) return null
    if (parsed.data.exp * 1000 < Date.now()) return null
    return parsed.data
  } catch {
    return null
  }
}

export async function issueMcpAuthorizationCode(input: {
  request: McpAuthorization
  client: McpOAuthClient
  userId: string
}): Promise<string | null> {
  const config = mcpOAuthConfig()
  if (!config?.emails.length) return null

  const code = randomBytes(32).toString('base64url')
  const row = await dbQueryOne<{ code_hash: string }>(
    `INSERT INTO mcp_oauth_codes
       (code_hash, client_id, user_id, redirect_uri, code_challenge, resource, scope)
     SELECT $1, $2, id, $4, $5, $6, $7 FROM users
     WHERE id = $3 AND is_admin = TRUE AND COALESCE(is_deleted, FALSE) = FALSE
       AND LOWER(email) = ANY($8::text[])
     RETURNING code_hash`,
    [
      hashMcpSecret(code),
      input.client.id,
      input.userId,
      input.request.redirect_uri,
      input.request.code_challenge,
      config.resource,
      MCP_CONTENT_SCOPE,
      config.emails,
    ],
  )
  if (!row) return null

  await logMcpOAuthEvent('code_issued', {
    clientId: input.client.id,
    userId: input.userId,
  })
  return code
}

function newTokens() {
  return {
    accessToken: `cfmcp_${randomBytes(32).toString('base64url')}`,
    refreshToken: `cfrefresh_${randomBytes(32).toString('base64url')}`,
  }
}

function tokenResponse(tokens: ReturnType<typeof newTokens>) {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: MCP_CONTENT_SCOPE,
  }
}

type ExchangeResult =
  | { ok: true; event: 'token_issued' | 'token_refreshed'; userId: string }
  | { ok: false; event: 'refresh_reuse'; userId: string }

export async function exchangeMcpToken(input: McpTokenRequest) {
  const config = mcpOAuthConfig()
  if (!config?.emails.length) return null

  const resource = input.resource ?? config.resource
  if (resource !== config.resource) return null

  const client = await resolveMcpClient(input.client_id)
  if (!client) return null

  const tokens = newTokens()

  const result = await withTransaction<ExchangeResult | null>(async (clientDb) => {
    if (input.grant_type === 'authorization_code') {
      const codes = await clientDb.query<{
        code_challenge: string
        user_id: string
      }>(
        `SELECT c.code_challenge, c.user_id FROM mcp_oauth_codes c
         JOIN users u ON u.id = c.user_id
         WHERE c.code_hash = $1 AND c.client_id = $2 AND c.redirect_uri = $3
           AND c.resource = $4 AND c.scope = $5 AND c.expires_at > NOW()
           AND u.is_admin = TRUE AND COALESCE(u.is_deleted, FALSE) = FALSE
           AND LOWER(u.email) = ANY($6::text[])
         FOR UPDATE OF c`,
        [
          hashMcpSecret(input.code),
          client.id,
          input.redirect_uri,
          config.resource,
          MCP_CONTENT_SCOPE,
          config.emails,
        ],
      )
      const code = codes.rows[0]
      if (!code || !secretEqual(code.code_challenge, mcpPkceChallenge(input.code_verifier))) {
        return null
      }

      await clientDb.query('DELETE FROM mcp_oauth_codes WHERE code_hash = $1', [
        hashMcpSecret(input.code),
      ])
      const grants = await clientDb.query<{ id: string }>(
        `INSERT INTO mcp_oauth_grants
           (client_id, user_id, resource, scope, access_token_hash, last_used_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [
          client.id,
          code.user_id,
          config.resource,
          MCP_CONTENT_SCOPE,
          hashMcpSecret(tokens.accessToken),
        ],
      )
      await clientDb.query(
        'INSERT INTO mcp_oauth_refresh_tokens (token_hash, grant_id) VALUES ($1, $2)',
        [hashMcpSecret(tokens.refreshToken), grants.rows[0].id],
      )
      await clientDb.query(
        'UPDATE mcp_oauth_clients SET last_used_at = NOW() WHERE id = $1',
        [client.id],
      )
      return { ok: true, event: 'token_issued', userId: code.user_id }
    }

    const refreshes = await clientDb.query<{
      id: string
      user_id: string
      used_at: string | null
    }>(
      `SELECT g.id, g.user_id, r.used_at FROM mcp_oauth_refresh_tokens r
       JOIN mcp_oauth_grants g ON g.id = r.grant_id
       JOIN users u ON u.id = g.user_id
       WHERE r.token_hash = $1 AND g.client_id = $2 AND g.resource = $3 AND g.scope = $4
         AND g.revoked_at IS NULL AND g.expires_at > NOW()
         AND u.is_admin = TRUE AND COALESCE(u.is_deleted, FALSE) = FALSE
         AND LOWER(u.email) = ANY($5::text[])
       FOR UPDATE OF g, r`,
      [
        hashMcpSecret(input.refresh_token),
        client.id,
        config.resource,
        MCP_CONTENT_SCOPE,
        config.emails,
      ],
    )
    const refresh = refreshes.rows[0]
    if (!refresh) return null

    if (refresh.used_at) {
      // Возвращаем результат, чтобы транзакция зафиксировала отзыв: throw
      // откатил бы его и повторное использование осталось бы безнаказанным.
      await clientDb.query(
        'UPDATE mcp_oauth_grants SET revoked_at = NOW() WHERE id = $1',
        [refresh.id],
      )
      return { ok: false, event: 'refresh_reuse', userId: refresh.user_id }
    }

    await clientDb.query(
      'UPDATE mcp_oauth_refresh_tokens SET used_at = NOW() WHERE token_hash = $1',
      [hashMcpSecret(input.refresh_token)],
    )
    await clientDb.query(
      `UPDATE mcp_oauth_grants
       SET access_token_hash = $1,
           access_expires_at = LEAST(NOW() + INTERVAL '1 hour', expires_at),
           last_used_at = NOW()
       WHERE id = $2`,
      [hashMcpSecret(tokens.accessToken), refresh.id],
    )
    await clientDb.query(
      'INSERT INTO mcp_oauth_refresh_tokens (token_hash, grant_id) VALUES ($1, $2)',
      [hashMcpSecret(tokens.refreshToken), refresh.id],
    )
    await clientDb.query(
      'UPDATE mcp_oauth_clients SET last_used_at = NOW() WHERE id = $1',
      [client.id],
    )
    return { ok: true, event: 'token_refreshed', userId: refresh.user_id }
  })

  if (!result) return null

  await logMcpOAuthEvent(result.event, {
    clientId: client.id,
    userId: result.userId,
  })

  return result.ok ? tokenResponse(tokens) : null
}

export async function authenticateMcpOAuthToken(token: string): Promise<string | null> {
  const config = mcpOAuthConfig()
  if (!config?.emails.length || !/^cfmcp_[a-zA-Z0-9_-]{43}$/.test(token)) return null

  const row = await dbQueryOne<{ user_id: string }>(
    `UPDATE mcp_oauth_grants g
     SET last_used_at = NOW()
     FROM users u
     WHERE g.user_id = u.id
       AND g.access_token_hash = $1
       AND g.resource = $2
       AND g.scope = $3
       AND g.revoked_at IS NULL
       AND g.access_expires_at > NOW()
       AND g.expires_at > NOW()
       AND u.is_admin = TRUE
       AND COALESCE(u.is_deleted, FALSE) = FALSE
       AND LOWER(u.email) = ANY($4::text[])
     RETURNING g.user_id`,
    [hashMcpSecret(token), config.resource, MCP_CONTENT_SCOPE, config.emails],
  )
  return row?.user_id ?? null
}

export async function revokeMcpOAuthToken(token: string, clientId?: string) {
  const client = clientId ? await resolveMcpClient(clientId) : null
  const hash = hashMcpSecret(token)

  // client_id не обязателен: token уже секрет, а RFC 7009 разрешает публичным
  // клиентам отзывать access/refresh token без дополнительных данных.
  await dbQuery(
    `UPDATE mcp_oauth_grants SET revoked_at = NOW()
     WHERE ($2::uuid IS NULL OR client_id = $2) AND (access_token_hash = $1 OR id IN
       (SELECT grant_id FROM mcp_oauth_refresh_tokens WHERE token_hash = $1))`,
    [hash, client?.id ?? null],
  )

  await logMcpOAuthEvent('token_revoked', { clientId: client?.id ?? null })
}

export interface McpOAuthGrantRow {
  id: string
  client_id: string
  client_name: string
  client_id_url: string | null
  user_id: string
  email: string | null
  scope: string
  created_at: string
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export async function listMcpOAuthGrants(): Promise<McpOAuthGrantRow[]> {
  return dbQuery<McpOAuthGrantRow>(
    `SELECT g.id, g.client_id, c.client_name, c.client_id_url, g.user_id, u.email,
            g.scope, g.created_at, g.expires_at, g.last_used_at, g.revoked_at
     FROM mcp_oauth_grants g
     JOIN mcp_oauth_clients c ON c.id = g.client_id
     LEFT JOIN users u ON u.id = g.user_id
     ORDER BY g.created_at DESC
     LIMIT 100`,
  )
}

export async function revokeMcpOAuthGrant(grantId: string) {
  await dbQuery(
    'UPDATE mcp_oauth_grants SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL',
    [grantId],
  )
  await logMcpOAuthEvent('token_revoked', {})
}

export async function logMcpOAuthEvent(
  event: McpOAuthEvent,
  input: { clientId?: string | null; userId?: string | null; ipHash?: string | null } = {},
) {
  try {
    await dbQuery(
      `INSERT INTO mcp_oauth_events (event, client_id, user_id, ip_hash)
       VALUES ($1, $2, $3, $4)`,
      [event, input.clientId ?? null, input.userId ?? null, input.ipHash ?? null],
    )
  } catch (error) {
    // Аудит не должен ломать авторизацию.
    console.error('[mcp-oauth] audit insert failed', error)
  }
}

export function hashMcpClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip') || ''
  return ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null
}

export async function cleanupMcpOAuth() {
  const codes = await dbQuery<{ code_hash: string }>(
    `DELETE FROM mcp_oauth_codes
     WHERE expires_at < NOW() - INTERVAL '1 day'
     RETURNING code_hash`,
  )
  const grants = await dbQuery<{ id: string }>(
    `DELETE FROM mcp_oauth_grants
     WHERE expires_at < NOW() - INTERVAL '30 days'
        OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
     RETURNING id`,
  )
  const clients = await dbQuery<{ id: string }>(
    `DELETE FROM mcp_oauth_clients c
     WHERE c.client_id_url IS NULL
       AND c.created_at < NOW() - INTERVAL '1 day'
       AND NOT EXISTS (SELECT 1 FROM mcp_oauth_grants g WHERE g.client_id = c.id)
     RETURNING id`,
  )
  const events = await dbQuery<{ id: string }>(
    `DELETE FROM mcp_oauth_events
     WHERE created_at < NOW() - INTERVAL '180 days'
     RETURNING id::text`,
  )

  return {
    codes: codes.length,
    grants: grants.length,
    clients: clients.length,
    events: events.length,
  }
}
