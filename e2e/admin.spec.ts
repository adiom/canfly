import { test, expect, type Page } from '@playwright/test'
import { loadTestCredentials, type TestCredentials } from './setup/credentials'
import { loginViaMagicLink } from './setup/login-helper'

const ADMIN_ROUTES = [
  '/admin',
  '/admin/characters/new',
  '/admin/news/new',
  '/admin/homepage-slides/new',
  '/admin/slider',
] as const

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

test.describe('smoke: admin routes (legacy /admin)', () => {
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

  for (const path of ADMIN_ROUTES) {
    test(`GET ${path}`, async ({ page }) => {
      const errors = attachErrorCollectors(page)

      const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(res!.status(), `HTTP status for ${path}`).toBeLessThan(400)

      await page.waitForLoadState('networkidle').catch(() => {})

      expect(errors, `runtime errors on ${path}:\n${errors.join('\n')}`).toEqual([])
    })
  }
})
