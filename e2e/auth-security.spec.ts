import { test, expect } from '@playwright/test'
import { loadTestCredentials } from './setup/credentials'

/**
 * Регрессия на обход аутентификации.
 *
 * Раньше Credentials.authorize принимал голый email и выдавал по нему сессию:
 * POST /api/auth/callback/credentials с email=<админ> давал полный доступ,
 * без кода и без почты. Теперь единственный фактор — magic-токен, который
 * проверяется и гасится внутри authorize.
 */

function testAdminEmail(): string {
  const creds = loadTestCredentials()
  if (!creds) throw new Error('e2e/.test-credentials.json отсутствует — не отработал global-setup')
  return creds.email
}

test.describe('credentials provider', () => {
  test('не выдаёт сессию по одному email, без токена', async ({ request }) => {
    const csrfRes = await request.get('/api/auth/csrf')
    expect(csrfRes.ok()).toBeTruthy()
    const { csrfToken } = await csrfRes.json() as { csrfToken: string }

    const res = await request.post('/api/auth/callback/credentials', {
      form: { csrfToken, email: testAdminEmail() },
      maxRedirects: 0,
      failOnStatusCode: false,
    })

    // next-auth отвечает редиректом на страницу ошибки, а не выдачей сессии
    const cookies = await request.storageState()
    const sessionCookie = cookies.cookies.find(c =>
      c.name === 'authjs.session-token' || c.name === '__Secure-authjs.session-token',
    )

    expect(sessionCookie, 'сессия не должна выдаваться без токена').toBeUndefined()
    expect(res.headers()['location'] ?? '').toContain('error')
  })

  test('не выдаёт сессию по произвольному коду', async ({ request }) => {
    const csrfRes = await request.get('/api/auth/csrf')
    const { csrfToken } = await csrfRes.json() as { csrfToken: string }

    await request.post('/api/auth/callback/credentials', {
      form: { csrfToken, email: testAdminEmail(), token: '12345678', via: 'code' },
      maxRedirects: 0,
      failOnStatusCode: false,
    })

    const cookies = await request.storageState()
    const sessionCookie = cookies.cookies.find(c =>
      c.name === 'authjs.session-token' || c.name === '__Secure-authjs.session-token',
    )
    expect(sessionCookie, 'случайный код не должен давать сессию').toBeUndefined()
  })
})

test.describe('приватные цитаты', () => {
  test('анонимный GET /api/chapter-highlights не отдаёт приватные', async ({ request }) => {
    // userId чужого пользователя не должен раскрывать его приватный архив
    const res = await request.get('/api/chapter-highlights?userId=00000000-0000-0000-0000-000000000001')
    expect(res.ok()).toBeTruthy()

    const { data } = await res.json() as { data: { is_public: boolean }[] }
    expect(Array.isArray(data)).toBeTruthy()
    expect(data.every(h => h.is_public), 'аноним видит только публичные цитаты').toBeTruthy()
  })
})

test.describe('LLM-эндпоинты', () => {
  for (const route of ['explain', 'meaning', 'rewrite', 'illustrate']) {
    test(`/api/highlights/${route} требует авторизации`, async ({ request }) => {
      const res = await request.post(`/api/highlights/${route}`, {
        data: { text: 'проверка', mode: 'другой-стиль' },
        failOnStatusCode: false,
      })
      expect(res.status()).toBe(401)
    })
  }
})
