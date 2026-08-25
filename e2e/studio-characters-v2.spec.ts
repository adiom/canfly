import { test, expect, type Page } from '@playwright/test'
import { loadTestCredentials, type TestCredentials } from './setup/credentials'
import { loginViaMagicLink } from './setup/login-helper'

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /tiptap warn/i,
  /immediatelyRender/i,
  /Next\.js detected\./i,
]

function attachErrorCollectors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) return
    errors.push(`[console.error] ${text}`)
  })
  page.on('requestfailed', (req) => {
    const url = req.url()
    if (url.includes('/_next/') || url.startsWith('chrome-extension://')) return
    errors.push(`[requestfailed] ${req.method()} ${url} → ${req.failure()?.errorText}`)
  })
  return errors
}

const CREDENTIALS = loadTestCredentials()

test.describe('smoke: studio characters-v2 (orbital editor)', () => {
  test.skip(
    !CREDENTIALS,
    'Test admin не создан — DATABASE_URL не настроен или globalSetup упал',
  )

  let credentials: TestCredentials

  test.beforeAll(() => {
    credentials = CREDENTIALS!
  })

  test.beforeEach(async ({ page }) => {
    await loginViaMagicLink(page, credentials.email)
  })

  test('GET /studio/characters-v2/[id] renders orbital editor without runtime errors', async ({ page }) => {
    test.setTimeout(60_000)
    const errors = attachErrorCollectors(page)

    // Берём первого персонажа из старого списка (он не меняется).
    await page.goto('/studio/characters', { waitUntil: 'load' })
    const editLink = page.locator('a[href^="/studio/characters/"]').first()
    let href: string | null = null
    try {
      await editLink.waitFor({ state: 'attached', timeout: 25_000 })
      href = await editLink.getAttribute('href')
    } catch {
      test.skip(true, 'no character cards rendered within 25s (dev compile or empty list)')
    }
    test.skip(
      !href || !href.includes('/studio/characters/'),
      'no characters to test v2 detail page',
    )

    // Переводим /studio/characters/{id} → /studio/characters-v2/{id}.
    const id = href!.split('/studio/characters/')[1].split('/')[0]
    const v2Href = `/studio/characters-v2/${id}`

    const res = await page.goto(v2Href, { waitUntil: 'load' })
    expect(res!.status(), `HTTP status for ${v2Href}`).toBeLessThan(400)
    await page.waitForLoadState('networkidle').catch(() => {})

    // Канвас и control-bar должны быть.
    await expect(page.locator('section#face')).toBeVisible()
    await expect(page.locator('section#passport')).toBeVisible()

    expect(errors, `runtime errors on ${v2Href}:\n${errors.join('\n')}`).toEqual([])
  })

  test('GET /studio/characters-v2/[id] for unknown id returns 404', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    const res = await page.goto('/studio/characters-v2/00000000-0000-0000-0000-000000000000', {
      waitUntil: 'domcontentloaded',
    })
    expect(res!.status()).toBe(404)
    expect(errors, `runtime errors on 404:\n${errors.join('\n')}`).toEqual([])
  })
})
