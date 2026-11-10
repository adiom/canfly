import { test, expect } from '@playwright/test'

test('Рогатка: guest can play offline when Game API requires login', async ({ page }) => {
  await page.route('**/api/games/q/progress', async route => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({
      authenticated: false, error: 'login_required',
    }) })
  })
  await page.goto('/games/q/game.html')
  await expect(page.locator('#sync')).toContainText('Гостевой режим')
  await page.locator('#shoot').click()
  await expect(page.locator('#shots')).toHaveText('1')
})

test('Рогатка: restores user history and posts score summary to API', async ({ page }) => {
  const writes: Array<Record<string, unknown>> = []
  await page.clock.install()
  await page.route('**/api/games/q/progress', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        authenticated: true,
        user: { id: '11111111-1111-4111-8111-111111111111', name: 'Игрок' },
        history: [{ kind: 'round_summary', details: { shots: 12, hits: 5 } }],
        lastScore: 5,
        bestScore: 5,
      }) })
    }
    writes.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, saved: true }) })
  })

  await page.goto('/games/q/game.html')
  await expect(page.locator('#shots')).toHaveText('12')
  await expect(page.locator('#hits')).toHaveText('5')
  await page.locator('#shoot').click()
  await expect(page.locator('#shots')).toHaveText('13')
  await expect(page.locator('#shoot')).toBeEnabled()
  await page.clock.fastForward(16_000)
  await expect.poll(() => writes.length).toBeGreaterThan(0)
  expect(writes.at(-1)).toMatchObject({
    kind: 'round_summary',
    details: { shots: 13, hits: 6 },
    score: 6,
  })
})
