import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { test, expect, type Locator, type Page } from '@playwright/test'

import { resolveCharacterChatAvailability } from '@/lib/ai/character-chat/availability'
import { fetchPublicCharactersList } from '@/lib/server/characters'
import { fetchEditionsByRelease, fetchReleaseChapterCounts } from '@/lib/server/editions'
import { fetchReleasesWithEditions } from '@/lib/server/releases'
import { canOpenEdition } from '@/lib/utils/editions'
import { loadEnvLocal } from './setup/pg'

/** Запуск без пишущих в БД хуков: pnpm exec playwright test -c playwright.v2.config.ts */
const errorsByPage = new WeakMap<Page, string[]>()
const ANALYTICS_URL = /^https:\/\/(?:mc\.yandex\.(?:ru|com)|mdd\.yandex\.net|va\.vercel-scripts\.com|vitals\.vercel-insights\.com)\//

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  errorsByPage.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !ANALYTICS_URL.test(message.location().url)) {
      errors.push(message.text())
    }
  })
  // Внешняя аналитика не относится к `/v2`; не отправляем тестовые просмотры.
  await page.route(ANALYTICS_URL, (route) => route.fulfill({ status: 200, body: '' }))
})

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page) ?? [], 'ошибки runtime / гидратации').toEqual([])
})

async function openV2(page: Page, hydrate = true) {
  const response = await page.goto('/v2', { waitUntil: 'domcontentloaded' })
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Истории\s*существуют\s+за пределами\s*страниц/)
  if (hydrate) {
    await expect(page.locator('button[aria-controls="v2-mobile-nav"]')).toBeEnabled({ timeout: 30_000 })
  }
}

async function checkHorizontalBounds(page: Page) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const clipped = [...document.querySelectorAll<HTMLElement>('main h1, main h2, main h3, main a, main button, header button')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
          && (rect.left < -1 || rect.right > width + 1)
      })
      .map((element) => element.textContent?.trim())
    return { width, scrollWidth: document.documentElement.scrollWidth, clipped }
  })
  expect(result.scrollWidth, 'горизонтальный скролл').toBeLessThanOrEqual(result.width)
  expect(result.clipped, 'обрезанный текст или действие').toEqual([])
}

async function canvasIsStill(canvas: Locator) {
  return canvas.evaluate(async (element: HTMLCanvasElement) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const first = element.toDataURL()
    await new Promise<void>((resolve) => {
      let frames = 0
      const next = () => ++frames === 6 ? resolve() : requestAnimationFrame(next)
      requestAnimationFrame(next)
    })
    return first === element.toDataURL()
  })
}

test.describe('v2: отдельная экспериментальная страница', () => {
  test('200, noindex/nofollow, собственный canonical и прежняя главная', async ({ page, request }, testInfo) => {
    await openV2(page)
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', /\/v2$/)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    for (const theme of ['light', 'dark'] as const) {
      if (!(await page.locator('html').getAttribute('class'))?.split(' ').includes(theme)) {
        await page.getByRole('button', { name: 'Toggle theme' }).click()
      }
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
      const screenshot = testInfo.outputPath(`desktop-${theme}.png`)
      await page.screenshot({ path: screenshot, animations: 'disabled' })
      await testInfo.attach(`desktop-${theme}`, { path: screenshot, contentType: 'image/png' })
    }
    const home = await request.get('/', { maxRedirects: 0 })
    expect(home.status()).toBe(200)
    expect(home.headers().location).toBeUndefined()
    expect(await home.text()).not.toMatch(/href="\/v2(?:["/#?])/)
    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    const paths = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => new URL(match[1]).pathname)
    expect(paths).toContain('/')
    expect(paths).not.toContain('/v2')
  })

  test('только опубликованные релизы, доступные издания и подтверждённые чаты', async ({ page }) => {
    loadEnvLocal()
    if (existsSync('.env')) loadEnvFile('.env')
    test.skip(!process.env.DATABASE_URL, 'для read-only сверки нужна БД приложения')
    await openV2(page)
    const [published, drafts, archived, characters] = await Promise.all([
      fetchReleasesWithEditions({ status: 'published' }),
      fetchReleasesWithEditions({ status: 'draft' }),
      fetchReleasesWithEditions({ status: 'archived' }),
      fetchPublicCharactersList(),
    ])
    const releaseLinks = await page.locator('a[href^="/release/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute('href')))],
    )
    expect(releaseLinks.length).toBeGreaterThan(0)
    for (const href of releaseLinks) {
      expect(published.some((release) => href === `/release/${release.slug}`), href ?? '').toBe(true)
    }
    for (const release of [...drafts, ...archived]) {
      expect(releaseLinks).not.toContain(`/release/${release.slug}`)
    }

    const media = published.find((release) => release.slug === 'ocean028')
    expect(media).toBeTruthy()
    if (!media) return
    const [editions, counts] = await Promise.all([
      fetchEditionsByRelease(media.id),
      fetchReleaseChapterCounts(media.id),
    ])
    const expectedLinks = editions.filter((edition) => canOpenEdition(edition, counts[edition.id] ?? 0))
      .map((edition) => `/vvvvv/${edition.slug}`).sort()
    const actualLinks = await page.locator('#media a[href^="/vvvvv/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')).sort(),
    )
    expect(actualLinks).toEqual(expectedLinks)

    const featured = published.find((release) => release.slug === 'kroy-po-dushe')
    expect(featured).toBeTruthy()
    if (featured) {
      const featuredEditions = await fetchEditionsByRelease(featured.id)
      for (const edition of featuredEditions.filter((item) => item.status !== 'published')) {
        await expect(page.locator(`a[href="/vvvvv/${edition.slug}"]`)).toHaveCount(0)
      }
      if (!featuredEditions.some((edition) => edition.format === 'audiobook' && edition.status === 'published')) {
        await expect(page.locator('#releases')).not.toContainText('Аудиокнига')
      }
    }

    for (const slug of ['sonya', 'Varvara', 'Mira']) {
      const character = characters.find((item) => item.slug === slug)
      expect(character).toBeTruthy()
      if (!character) continue
      const availability = resolveCharacterChatAvailability({ character })
      await expect(page.locator(`#characters a[href="/characters/${slug}/chat"]`))
        .toHaveCount(availability.canGenerate ? 1 : 0)
    }
  })

  test('граф загружается при приближении, выбор работает с клавиатуры, Escape возвращает фокус', async ({ page }) => {
    await openV2(page)
    const graph = page.locator('#connections')
    await expect(graph.getByRole('button')).toHaveCount(0)
    const summary = graph.getByText('Текстовая схема связей', { exact: true })
    await summary.scrollIntoViewIfNeeded()
    const sonya = graph.getByRole('button', { name: /Соня\s+персонаж/i })
    await expect(sonya).toBeVisible()
    await sonya.scrollIntoViewIfNeeded()
    await sonya.focus()
    await page.keyboard.press('Enter')
    await expect(sonya).toHaveAttribute('aria-pressed', 'true')
    const description = graph.getByRole('complementary', { name: 'Соня', exact: true })
    await expect(description).toBeVisible()
    await expect(description.getByRole('link', { name: 'Открыть на Canfly ↗' }))
      .toHaveAttribute('href', '/characters/sonya')
    await description.getByRole('button', { name: 'Закрыть описание' }).focus()
    await page.keyboard.press('Escape')
    await expect(description).toHaveCount(0)
    await expect(sonya).toHaveAttribute('aria-pressed', 'false')
    await expect(sonya).toBeFocused()

    await summary.click()
    const details = graph.locator('details')
    await expect(details).toHaveAttribute('open', '')
    await expect(details.getByRole('listitem').filter({ hasText: 'Союзник' })).toHaveCount(2)
    await expect(details.getByRole('listitem').filter({ hasText: /Крой по душе.*главная роль.*Соня/ })).toHaveCount(1)
  })

  test('Аудио/Книга меняет визуализацию, а не запускает воспроизведение', async ({ page }) => {
    await openV2(page)
    const media = page.locator('#media')
    await media.getByRole('heading', { level: 2 }).scrollIntoViewIfNeeded()
    const view = media.getByRole('group', { name: 'Способ восприятия' })
    const audio = view.getByRole('button', { name: 'Аудио', exact: true })
    const book = view.getByRole('button', { name: 'Книга', exact: true })
    await expect(audio).toHaveAttribute('aria-pressed', 'true')
    await expect(media.locator('svg rect')).toHaveCount(48)
    await book.click()
    await expect(book).toHaveAttribute('aria-pressed', 'true')
    await expect(audio).toHaveAttribute('aria-pressed', 'false')
    await expect(media.locator('svg rect')).toHaveCount(0)
    await audio.click()
    await expect(media.locator('svg rect')).toHaveCount(48)
    await expect(media.locator('audio, video, iframe')).toHaveCount(0)
    await expect(media.locator('a[href^="/vvvvv/"]')).toHaveCount(2)
  })

  test('мобильное меню: якорь, закрытие и размер действий', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openV2(page)
    const menu = page.getByRole('button', { name: 'Меню разделов' })
    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    const panel = page.locator('#v2-mobile-nav')
    await expect(panel).toBeVisible()
    await panel.getByRole('link', { name: 'Связи', exact: true }).click()
    await expect(page).toHaveURL(/\/v2#connections$/)
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(panel).toBeHidden()
    const graph = page.locator('#connections')
    await expect(graph.getByRole('button', { name: /Соня\s+персонаж/i })).toBeVisible()
    for (const button of await graph.getByRole('button').all()) {
      const box = await button.boundingBox()
      // DOMRect после transform может вернуть 43.99997 вместо CSS 44px.
      expect(Number((box?.height ?? 0).toFixed(3))).toBeGreaterThanOrEqual(44)
      expect(Number((box?.width ?? 0).toFixed(3))).toBeGreaterThanOrEqual(44)
    }
    await checkHorizontalBounds(page)
  })

  test('canvas учитывает DPR/resize и перестаёт двигаться при reduced-motion', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openV2(page)
    const canvas = page.locator('canvas')
    await expect(canvas).toHaveCount(1, { timeout: 30_000 })
    const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(before)
    await page.setViewportSize({ width: 768, height: 900 })
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      expected: Math.round(window.innerWidth * Math.min(devicePixelRatio, 2)),
      cssWidth: element.getBoundingClientRect().width,
    }))).toEqual({ width: 768, expected: 768, cssWidth: 768 })
    await canvas.evaluate((element: HTMLCanvasElement) => { element.style.display = 'none' })
    expect(await canvasIsStill(canvas), 'невидимый canvas должен останавливаться').toBe(true)
    await canvas.evaluate((element: HTMLCanvasElement) => { element.style.display = '' })
    const resumed = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(resumed)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await canvasIsStill(canvas), 'reduced-motion должен останавливать canvas').toBe(true)
    await page.getByRole('link', { name: 'Canfly — главная' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(canvas).toHaveCount(0)
  })
})

test.describe('v2: retina canvas', () => {
  test.use({ deviceScaleFactor: 2 })
  test('DPR 2 увеличивает буфер, но не CSS-размер canvas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openV2(page)
    const canvas = page.locator('canvas')
    await expect(canvas).toHaveCount(1, { timeout: 30_000 })
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      height: element.height,
      cssWidth: element.getBoundingClientRect().width,
      cssHeight: element.getBoundingClientRect().height,
    }))).toEqual({ width: 780, height: 1688, cssWidth: 390, cssHeight: 844 })
  })
})

test.describe('v2: адаптивность и темы', () => {
  for (const width of [360, 390, 768, 1440]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${width}px / ${theme}: читаемые CTA, сцены и нет переполнения`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
        await openV2(page)
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
        const foreground = theme === 'light' ? 'rgb(244, 239, 229)' : 'rgb(17, 18, 16)'
        const background = theme === 'light' ? 'rgb(17, 18, 16)' : 'rgb(244, 239, 229)'
        const primary = page.getByRole('link', { name: 'Войти в пространство', exact: true })
        await expect(primary).toHaveCSS('color', foreground)
        await expect(primary).toHaveCSS('background-color', background)
        await primary.focus()
        await expect(primary).toHaveCSS('outline-style', 'solid')

        for (const heading of await page.locator('main').getByRole('heading', { level: 2 }).all()) {
          await heading.scrollIntoViewIfNeeded()
          await expect(heading).toBeVisible()
          await checkHorizontalBounds(page)
        }
        const explore = page.locator('main > section').last()
        const exploreCta = explore.getByRole('link', { name: 'Все релизы ↗', exact: true })
        await exploreCta.scrollIntoViewIfNeeded()
        await expect(exploreCta).toHaveCSS('color', foreground)
        await expect(exploreCta).toHaveCSS('background-color', background)
        for (const button of await page.getByRole('button').all()) {
          if (!(await button.isVisible())) continue
          const box = await button.boundingBox()
          expect(Number((box?.height ?? 0).toFixed(3))).toBeGreaterThanOrEqual(44)
          expect(Number((box?.width ?? 0).toFixed(3))).toBeGreaterThanOrEqual(44)
        }
        await checkHorizontalBounds(page)

        if (width === 390 || width === 1440) {
          await page.evaluate(() => window.scrollTo(0, 0))
          const screenshot = testInfo.outputPath(`v2-${width}-${theme}.png`)
          await page.screenshot({ path: screenshot, animations: 'disabled' })
          await testInfo.attach(`v2-${width}-${theme}`, { path: screenshot, contentType: 'image/png' })
        }
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.getByRole('button', { name: 'Toggle theme' }).click()
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme === 'light' ? 'dark' : 'light'}\\b`))
      })
    }
  }

  test('reduced-motion с первого входа: весь текст видим, анимаций нет', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openV2(page)
    await expect(page.locator('[data-v2-reveal="pending"]')).toHaveCount(0)
    for (const heading of await page.getByRole('heading').all()) await expect(heading).toBeVisible()
    const animations = await page.locator('main').evaluate((main) =>
      main.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length,
    )
    expect(animations).toBe(0)
  })
})

test.describe('v2: без JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('серверный текст, ссылки и текстовая схема доступны без гидратации', async ({ page }) => {
    await openV2(page, false)
    await expect(page.locator('[data-v2-reveal="pending"]')).toHaveCount(0)
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 2, name: 'Крой по душе' })).toBeVisible()
    const graph = page.locator('#connections')
    await graph.getByText('Текстовая схема связей', { exact: true }).click()
    await expect(graph.locator('details')).toHaveAttribute('open', '')
    await expect(graph.getByRole('listitem').first()).toBeVisible()
    await expect(graph.getByRole('button')).toHaveCount(0)
    await expect(page.locator('#media a[href^="/vvvvv/"]')).toHaveCount(2)
    await checkHorizontalBounds(page)
  })
})
