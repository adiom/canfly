import { test, expect, type Page } from '@playwright/test'
import { feedPageSchema } from '../lib/v2-feed'

const analytics = /(?:mc\.yandex|vercel-insights|vercel-scripts)/

test.beforeEach(async ({ page }) => {
  await page.route(analytics, (route) => route.fulfill({ status: 200, body: '' }))
})

async function openJournal(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/v2')
  await expect(page.getByRole('heading', { name: 'Истории рядом.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ещё истории' })).toBeEnabled()
}

test('bounded cursor pages advance without duplicate materials; malformed cursors are rejected', async ({ request }) => {
  const first = await request.get('/api/v2/feed')
  expect(first.ok()).toBeTruthy()
  const page = feedPageSchema.parse(await first.json())
  expect(page.items.length).toBeLessThanOrEqual(10)
  const replay = await request.get('/api/v2/feed', { params: { cursor: page.startCursor } })
  expect((await replay.json()).items).toEqual(page.items)
  if (page.nextCursor) {
    const next = feedPageSchema.parse(await (await request.get('/api/v2/feed', { params: { cursor: page.nextCursor } })).json())
    const ids = new Set(page.items.map((item) => item.id))
    expect(next.items.some((item) => ids.has(item.id))).toBe(false)
    expect(next.nextCursor).not.toBe(page.nextCursor)
  }
  for (const cursor of ['not-a-cursor', 'a'.repeat(3100), Buffer.from('{"version":99}').toString('base64url')]) {
    expect((await request.get('/api/v2/feed', { params: { cursor } })).status()).toBe(400)
  }
  const serialized = JSON.stringify(page.items)
  expect(serialized).not.toMatch(/"(?:system_role|personality|boundaries|knowledge_scope|draft_text|user_id)"/)
})

test('mobile scroll appends materials, preserves the beginning, and has no horizontal overflow', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openJournal(page)
  const articles = page.locator('[data-feed-id]')
  const before = await articles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-feed-id')))
  const continuation = page.getByRole('button', { name: 'Ещё истории' })
  await continuation.scrollIntoViewIfNeeded()
  await expect.poll(() => articles.count()).toBeGreaterThan(before.length)
  const after = await articles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-feed-id')))
  expect(after.slice(0, before.length)).toEqual(before)
  expect(new Set(after).size).toBe(after.length)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})

test('failed continuation keeps existing content and can be retried', async ({ page }) => {
  let fail = true
  await page.route('**/api/v2/feed?*', async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { error: 'test outage' } })
    else await route.continue()
  })
  await openJournal(page)
  const count = await page.locator('[data-feed-id]').count()
  await page.getByRole('button', { name: 'Ещё истории' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Попробовать снова' })).toBeVisible()
  expect(await page.locator('[data-feed-id]').count()).toBe(count)
  fail = false
  await page.getByRole('button', { name: 'Попробовать снова' }).click()
  await expect.poll(() => page.locator('[data-feed-id]').count()).toBeGreaterThan(count)
})

test('returning from a material restores loaded pages and the reading position', async ({ page }) => {
  await openJournal(page)
  await page.getByRole('button', { name: 'Ещё истории' }).scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('[data-feed-id]').count()).toBeGreaterThan(10)
  const count = await page.locator('[data-feed-id]').count()
  const article = page.locator('[data-feed-kind="excerpt"]').last()
  await article.scrollIntoViewIfNeeded()
  const link = article.getByRole('link', { name: 'Читать дальше' })
  await link.scrollIntoViewIfNeeded()
  const y = await page.evaluate(() => scrollY)
  const href = await link.getAttribute('href')
  const chapterTitle = await article.getByRole('heading', { level: 3 }).innerText()
  await link.click()
  await expect(page).toHaveURL(new RegExp(`chapter=${href?.split('chapter=')[1]}`))
  await expect(page.getByRole('heading', { level: 1, name: chapterTitle, exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-feed-id]')).toHaveCount(count)
  await expect.poll(async () => Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThan(200)
})

test('first materials are server-rendered without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/v2')
  await expect(page.locator('[data-feed-id]').first()).toBeVisible()
  expect(await page.locator('noscript').evaluate((element) => element.textContent)).toContain('Первые материалы доступны без JavaScript')
  await context.close()
})
