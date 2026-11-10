import { test, expect } from '@playwright/test'

test.describe('Canfly Game API v0.1', () => {
  test('rejects anonymous access without leaking user state', async ({ request }) => {
    const response = await request.get('/api/games/still-road/progress')
    expect(response.status()).toBe(401)
    expect(await response.json()).toMatchObject({
      authenticated: false,
      error: 'login_required',
    })
  })

  test('rejects cross-origin game writes before reading session', async ({ request }) => {
    const response = await request.post('/api/games/still-road/progress', {
      headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' },
      data: {
        requestId: '11111111-1111-4111-8111-111111111111',
        kind: 'checkpoint',
        details: { scene: 'forest' },
      },
    })
    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'invalid_origin' })
  })
})
