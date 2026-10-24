import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import {
  MCP_CONTENT_SCOPE,
  mcpAuthorizationSchema,
  mcpClientSchema,
  type McpAuthorization,
  type McpTokenRequest,
} from '@/lib/schemas/mcp-oauth'

export function mcpOAuthConfig() {
  const base = process.env.NEXT_PUBLIC_BASE_URL
  if (!base) return null
  try {
    const url = new URL(base)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    const issuer = url.origin
    const emails = (process.env.MCP_OAUTH_ALLOWED_EMAILS ?? '').split(',')
      .map((email) => email.trim().toLowerCase()).filter(Boolean)
    return { issuer, resource: `${issuer}/api/mcp`, emails }
  } catch {
    return null
  }
}

export function mcpOAuthEnabled(): boolean {
  return !!mcpOAuthConfig()?.emails.length
}

export function mcpOAuthUserAllowed(user: { email: string | null; is_admin: boolean }): boolean {
  return user.is_admin && !!user.email &&
    !!mcpOAuthConfig()?.emails.includes(user.email.toLowerCase())
}

export function hashMcpSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function mcpPkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function secretEqual(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(hashMcpSecret(a), 'hex'), Buffer.from(hashMcpSecret(b), 'hex'))
}

export function mcpProtectedResourceMetadata() {
  const config = mcpOAuthConfig()
  if (!config) return null
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
  if (!config) return null
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
  }
}

export async function registerMcpClient(input: unknown) {
  const parsed = mcpClientSchema.safeParse(input)
  if (!parsed.success || !mcpOAuthEnabled()) return null
  const row = await dbQueryOne<{ id: string; created_at: string }>(
    `INSERT INTO mcp_oauth_clients (client_name, redirect_uris)
     VALUES ($1, $2) RETURNING id, created_at`,
    [parsed.data.client_name, [...new Set(parsed.data.redirect_uris)]],
  )
  if (!row) return null
  return {
    ...parsed.data,
    client_id: row.id,
    client_id_issued_at: Math.floor(new Date(row.created_at).getTime() / 1000),
  }
}

export async function validateMcpAuthorization(input: unknown) {
  const parsed = mcpAuthorizationSchema.safeParse(input)
  const config = mcpOAuthConfig()
  if (!parsed.success || !config?.emails.length || parsed.data.resource !== config.resource) return null
  const client = await dbQueryOne<{ client_name: string; redirect_uris: string[] }>(
    'SELECT client_name, redirect_uris FROM mcp_oauth_clients WHERE id = $1',
    [parsed.data.client_id],
  )
  if (!client?.redirect_uris.includes(parsed.data.redirect_uri)) return null
  return { request: parsed.data, clientName: client.client_name }
}

export function mcpAuthorizationRedirect(request: McpAuthorization, response: { code: string } | { error: string }) {
  const config = mcpOAuthConfig()
  if (!config) throw new Error('MCP OAuth is not configured')
  const url = new URL(request.redirect_uri)
  for (const [key, value] of Object.entries(response)) url.searchParams.set(key, value)
  url.searchParams.set('state', request.state)
  url.searchParams.set('iss', config.issuer)
  return url.toString()
}

export async function issueMcpAuthorizationCode(request: McpAuthorization, userId: string) {
  const config = mcpOAuthConfig()
  if (!config?.emails.length || !(await validateMcpAuthorization(request))) return null
  const code = randomBytes(32).toString('base64url')
  // Recheck the live role, account status and allowlist inside the INSERT.
  const row = await dbQueryOne<{ code_hash: string }>(
    `INSERT INTO mcp_oauth_codes
       (code_hash, client_id, user_id, redirect_uri, code_challenge, resource, scope)
     SELECT $1, $2, id, $4, $5, $6, $7 FROM users
     WHERE id = $3 AND is_admin = TRUE AND COALESCE(is_deleted, FALSE) = FALSE
       AND LOWER(email) = ANY($8::text[])
     RETURNING code_hash`,
    [hashMcpSecret(code), request.client_id, userId, request.redirect_uri,
      request.code_challenge, config.resource, MCP_CONTENT_SCOPE, config.emails],
  )
  return row ? code : null
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

export async function exchangeMcpToken(input: McpTokenRequest) {
  const config = mcpOAuthConfig()
  if (!config?.emails.length || input.resource !== config.resource) return null
  const tokens = newTokens()
  const result = await withTransaction(async (client) => {
    if (input.grant_type === 'authorization_code') {
      const codes = await client.query<{ code_challenge: string; user_id: string }>(
        `SELECT c.code_challenge, c.user_id FROM mcp_oauth_codes c
         JOIN users u ON u.id = c.user_id
         WHERE c.code_hash = $1 AND c.client_id = $2 AND c.redirect_uri = $3
           AND c.resource = $4 AND c.scope = $5 AND c.expires_at > NOW()
           AND u.is_admin = TRUE AND COALESCE(u.is_deleted, FALSE) = FALSE
           AND LOWER(u.email) = ANY($6::text[])
         FOR UPDATE OF c`,
        [hashMcpSecret(input.code), input.client_id, input.redirect_uri,
          config.resource, MCP_CONTENT_SCOPE, config.emails],
      )
      const code = codes.rows[0]
      if (!code || !secretEqual(code.code_challenge, mcpPkceChallenge(input.code_verifier))) return false
      await client.query('DELETE FROM mcp_oauth_codes WHERE code_hash = $1', [hashMcpSecret(input.code)])
      const grants = await client.query<{ id: string }>(
        `INSERT INTO mcp_oauth_grants (client_id, user_id, resource, scope, access_token_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [input.client_id, code.user_id, config.resource, MCP_CONTENT_SCOPE, hashMcpSecret(tokens.accessToken)],
      )
      await client.query(
        'INSERT INTO mcp_oauth_refresh_tokens (token_hash, grant_id) VALUES ($1, $2)',
        [hashMcpSecret(tokens.refreshToken), grants.rows[0].id],
      )
      return true
    }

    const refreshes = await client.query<{ id: string; used_at: string | null }>(
      `SELECT g.id, r.used_at FROM mcp_oauth_refresh_tokens r
       JOIN mcp_oauth_grants g ON g.id = r.grant_id JOIN users u ON u.id = g.user_id
       WHERE r.token_hash = $1 AND g.client_id = $2 AND g.resource = $3 AND g.scope = $4
         AND g.revoked_at IS NULL AND g.expires_at > NOW()
         AND u.is_admin = TRUE AND COALESCE(u.is_deleted, FALSE) = FALSE
         AND LOWER(u.email) = ANY($5::text[])
       FOR UPDATE OF g, r`,
      [hashMcpSecret(input.refresh_token), input.client_id, config.resource, MCP_CONTENT_SCOPE, config.emails],
    )
    const refresh = refreshes.rows[0]
    if (!refresh) return false
    if (refresh.used_at) {
      // Commit the revocation; throwing here would roll it back.
      await client.query('UPDATE mcp_oauth_grants SET revoked_at = NOW() WHERE id = $1', [refresh.id])
      return false
    }
    await client.query('UPDATE mcp_oauth_refresh_tokens SET used_at = NOW() WHERE token_hash = $1',
      [hashMcpSecret(input.refresh_token)])
    await client.query(
      `UPDATE mcp_oauth_grants SET access_token_hash = $1,
         access_expires_at = LEAST(NOW() + INTERVAL '1 hour', expires_at) WHERE id = $2`,
      [hashMcpSecret(tokens.accessToken), refresh.id],
    )
    await client.query('INSERT INTO mcp_oauth_refresh_tokens (token_hash, grant_id) VALUES ($1, $2)',
      [hashMcpSecret(tokens.refreshToken), refresh.id])
    return true
  })
  return result ? tokenResponse(tokens) : null
}

export async function authenticateMcpOAuthToken(token: string): Promise<string | null> {
  const config = mcpOAuthConfig()
  if (!config?.emails.length || !/^cfmcp_[a-zA-Z0-9_-]{43}$/.test(token)) return null
  const row = await dbQueryOne<{ user_id: string }>(
    `SELECT g.user_id FROM mcp_oauth_grants g JOIN users u ON u.id = g.user_id
     WHERE g.access_token_hash = $1 AND g.resource = $2 AND g.scope = $3
       AND g.revoked_at IS NULL AND g.access_expires_at > NOW() AND g.expires_at > NOW()
       AND u.is_admin = TRUE AND COALESCE(u.is_deleted, FALSE) = FALSE
       AND LOWER(u.email) = ANY($4::text[])`,
    [hashMcpSecret(token), config.resource, MCP_CONTENT_SCOPE, config.emails],
  )
  return row?.user_id ?? null
}

export async function revokeMcpOAuthToken(token: string, clientId: string) {
  await dbQuery(
    `UPDATE mcp_oauth_grants SET revoked_at = NOW()
     WHERE client_id = $1 AND (access_token_hash = $2 OR id IN
       (SELECT grant_id FROM mcp_oauth_refresh_tokens WHERE token_hash = $2))`,
    [clientId, hashMcpSecret(token)],
  )
}
