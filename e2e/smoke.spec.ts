import { test, expect, type Page } from '@playwright/test'

const PUBLIC_ROUTES = [
  '/',
  '/home',
  '/releases',
  '/characters',
  '/news',
  '/search',
  '/login',
  '/admin/login',
] as const

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /tiptap warn/i,
  /immediatelyRender/i,
  /Next\.js detected\./i,
  /^http.*\/api\/auth\/session.*ERR_ABORTED/i,
  /ClientFetchError/i,
]

function attachErrorCollectors(page: Page) {
  const errors: string[] = []

  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`)
  })

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) return
    errors.push(`[console.error] ${text}`)
  })

  page.on('requestfailed', (req) => {
    const url = req.url()
    if (url.includes('/_next/') || url.startsWith('chrome-extension://') || url.includes('/api/auth/session') || url.includes('mc.yandex')) return
    errors.push(`[requestfailed] ${req.method()} ${url} → ${req.failure()?.errorText}`)
  })

  return errors
}

test.describe('smoke: public routes load without runtime errors', () => {
  for (const path of PUBLIC_ROUTES) {
    test(`GET ${path}`, async ({ page }) => {
      const errors = attachErrorCollectors(page)

      const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(res, `no response for ${path}`).not.toBeNull()
      expect(res!.status(), `HTTP status for ${path}`).toBeLessThan(400)

      await page.waitForLoadState('networkidle').catch(() => {})

      expect(errors, `runtime errors on ${path}:\n${errors.join('\n')}`).toEqual([])
    })
  }
})

test.describe('smoke: character profile tabs', () => {
  test('first character profile loads + each tab works', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = attachErrorCollectors(page)

    await page.goto('/characters', { waitUntil: 'domcontentloaded' })

    const firstLink = page.locator('a[href^="/characters/"]').first()
    const href = await firstLink.getAttribute('href')
    test.skip(!href || href === '/characters', 'no characters in DB')

    const basePath = href!.split('?')[0]
    const tabs = ['feed', 'about', 'relations', 'wall']

    for (const tab of tabs) {
      const res = await page.goto(`${basePath}?tab=${tab}`, { waitUntil: 'domcontentloaded' })
      expect(res, `no response for ${basePath}?tab=${tab}`).not.toBeNull()
      expect(res!.status(), `HTTP status for tab=${tab}`).toBeLessThan(400)
      await page.waitForLoadState('networkidle').catch(() => {})
    }

    expect(errors, `runtime errors on character profile:\n${errors.join('\n')}`).toEqual([])
  })
})
