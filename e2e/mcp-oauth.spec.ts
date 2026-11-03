import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * OAuth-контур MCP: discovery, защита /api/mcp и allowlist регистрации клиента.
 *
 * OAuth включается только переменными окружения, поэтому тесты сначала
 * проверяют метаданные ресурса и пропускаются, если сервер работает в режиме
 * одного статического MCP_TOKEN.
 */

interface ResourceMetadata {
  resource: string
  authorization_servers: string[]
  scopes_supported: string[]
}

interface ServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint: string
  revocation_endpoint: string
  code_challenge_methods_supported: string[]
}

async function oauthEnabled(request: APIRequestContext): Promise<boolean> {
  const res = await request.get('/.well-known/oauth-protected-resource', {
    failOnStatusCode: false,
  })
  if (res.status() === 404) return false
  expect(res.ok()).toBeTruthy()
  return true
}

const codeChallenge = 'a'.repeat(43)

test.describe('MCP OAuth discovery', () => {
  test('метаданные ресурса и authorization server согласованы', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен: задан только MCP_TOKEN')

    const resourceRes = await request.get('/.well-known/oauth-protected-resource')
    expect(resourceRes.ok()).toBeTruthy()
    const resource = await resourceRes.json() as ResourceMetadata

    expect(resource.resource).toMatch(/\/api\/mcp$/)
    expect(resource.scopes_supported).toContain('canfly:content')
    expect(resource.authorization_servers.length).toBeGreaterThan(0)

    const serverRes = await request.get('/.well-known/oauth-authorization-server')
    expect(serverRes.ok()).toBeTruthy()
    const server = await serverRes.json() as ServerMetadata

    expect(server.issuer).toBe(resource.authorization_servers[0])
    expect(server.authorization_endpoint).toBe(`${server.issuer}/oauth/mcp/authorize`)
    expect(server.token_endpoint).toBe(`${server.issuer}/api/oauth/mcp/token`)
    expect(server.registration_endpoint).toBe(`${server.issuer}/api/oauth/mcp/register`)
    expect(server.revocation_endpoint).toBe(`${server.issuer}/api/oauth/mcp/revoke`)
    expect(server.code_challenge_methods_supported).toContain('S256')
  })

  test('path-specific protected resource metadata ведёт на тот же ресурс', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const res = await request.get('/.well-known/oauth-protected-resource/api/mcp')
    expect(res.ok()).toBeTruthy()
    const metadata = await res.json() as ResourceMetadata
    expect(metadata.resource).toMatch(/\/api\/mcp$/)
  })
})

test.describe('защита /api/mcp', () => {
  test('без токена не отдаёт данные и не открывает tools/list', async ({ request }) => {
    const res = await request.post('/api/mcp', {
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      failOnStatusCode: false,
    })

    expect([401, 503]).toContain(res.status())
    const body = await res.text()
    expect(body).not.toContain('canfly_create_release')
  })

  test('неверный Bearer не проходит авторизацию', async ({ request }) => {
    const res = await request.post('/api/mcp', {
      headers: { Authorization: 'Bearer definitely-not-a-valid-token' },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      failOnStatusCode: false,
    })

    expect([401, 503]).toContain(res.status())
    const body = await res.text()
    expect(body).not.toContain('canfly_create_release')
  })

  test('при включённом OAuth 401 содержит resource_metadata', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const res = await request.get('/api/mcp', { failOnStatusCode: false })
    expect(res.status()).toBe(401)

    const challenge = res.headers()['www-authenticate'] ?? ''
    expect(challenge).toContain('resource_metadata=')
    expect(challenge).toContain('/.well-known/oauth-protected-resource')
    expect(challenge).toContain('canfly:content')
  })
})

test.describe('регистрация клиента', () => {
  test('отклоняет redirect URI вне allowlist', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const res = await request.post('/api/oauth/mcp/register', {
      data: {
        client_name: 'evil',
        redirect_uris: ['https://evil.example/callback'],
      },
      failOnStatusCode: false,
    })

    expect(res.status()).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('invalid_client_metadata')
  })

  test('регистрирует loopback-клиента и выдаёт UUID', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const res = await request.post('/api/oauth/mcp/register', {
      data: {
        client_name: 'e2e loopback',
        redirect_uris: ['http://127.0.0.1:49876/callback'],
      },
      failOnStatusCode: false,
    })

    expect(res.status()).toBe(201)
    const body = await res.json() as { client_id: string; token_endpoint_auth_method: string }
    expect(body.client_id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(body.token_endpoint_auth_method).toBe('none')
  })
})

test.describe('token и revoke', () => {
  test('неизвестный код не обменивается на токен', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const redirectUri = 'http://127.0.0.1:49877/callback'
    const registered = await request.post('/api/oauth/mcp/register', {
      data: { client_name: 'e2e token', redirect_uris: [redirectUri] },
      failOnStatusCode: false,
    })
    expect(registered.status()).toBe(201)
    const { client_id: clientId } = await registered.json() as { client_id: string }

    const res = await request.post('/api/oauth/mcp/token', {
      form: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: 'a'.repeat(43),
        redirect_uri: redirectUri,
        code_verifier: 'b'.repeat(43),
      },
      failOnStatusCode: false,
    })

    expect(res.status()).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('invalid_grant')
  })

  test('чужой resource отклоняется до обмена кода', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const redirectUri = 'http://127.0.0.1:49878/callback'
    const registered = await request.post('/api/oauth/mcp/register', {
      data: { client_name: 'e2e resource', redirect_uris: [redirectUri] },
      failOnStatusCode: false,
    })
    const { client_id: clientId } = await registered.json() as { client_id: string }

    const res = await request.post('/api/oauth/mcp/token', {
      form: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: 'a'.repeat(43),
        redirect_uri: redirectUri,
        code_verifier: 'b'.repeat(43),
        resource: 'https://other.example/api/mcp',
      },
      failOnStatusCode: false,
    })

    expect(res.status()).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('invalid_target')
  })

  test('revoke неизвестного токена отвечает 200', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const res = await request.post('/api/oauth/mcp/revoke', {
      form: { token: 'cfmcp_unknown' },
      failOnStatusCode: false,
    })

    expect(res.status()).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

test.describe('страница согласия', () => {
  test('неизвестный client_id даёт понятную ошибку, а не форму', async ({ request }) => {
    test.skip(!(await oauthEnabled(request)), 'OAuth выключен')

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: '00000000-0000-4000-8000-000000000000',
      redirect_uri: 'http://127.0.0.1:49876/callback',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: 'e2e-state',
    })

    const res = await request.get(`/oauth/mcp/authorize?${params.toString()}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('Некорректный запрос')
    expect(html).not.toContain('Разрешить доступ')
  })
})
