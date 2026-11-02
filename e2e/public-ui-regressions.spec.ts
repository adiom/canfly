import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { Client } from 'pg'
import { loadEnvLocal, pgConfig } from './setup/pg'
import { loadTestCredentials, type TestCredentials } from './setup/credentials'
import { loginViaMagicToken } from './setup/login-helper'

test.describe('public interface regressions', () => {
  test('landscape search fits the screen and has an explicit empty state', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 })
    await page.route('**/api/search?*', route => route.fulfill({ json: { results: [] } }))
    await page.goto('/colors')
    await page.getByRole('button', { name: 'Поиск (Cmd+K)' }).click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').fill('несуществующий')
    await expect(dialog.getByText('Ничего не найдено')).toBeVisible()
    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(375)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('arrows and Enter select an actual search result', async ({ page }) => {
    await page.route('**/api/search?*', route => route.fulfill({ json: {
      results: [{ id: 'test-release', kind: 'release', title: 'Тестовый релиз', subtitle: 'Проверка', href: '/colors?selected=release', image: null }],
    } }))
    await page.goto('/colors')
    await page.getByRole('button', { name: 'Поиск (Cmd+K)' }).click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').fill('тест')
    const result = dialog.getByRole('option', { name: /Тестовый релиз/ })
    await expect(result).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await expect(result).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/selected=release/)
    await expect(dialog).not.toBeVisible()
  })

  test('mobile menu close button is visible above the sticky header', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/colors')
    await page.getByRole('button', { name: /меню/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /close|закрыть/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('reading progress endpoint retains its authentication requirement', async ({ request }) => {
    const response = await request.post('/api/reading-progress', { data: {
      editionId: '11111111-1111-4111-8111-111111111111',
      chapterId: '22222222-2222-4222-8222-222222222222',
      progressPercent: 100,
      position: { paragraphIndex: 3, offset: 10 },
    } })
    expect(response.status()).toBe(401)
  })
})

test.describe('show_in_catalog: флаг видимости в каталоге релизов', () => {
  test.skip(
    !loadTestCredentials(),
    'Test admin не создан — DATABASE_URL не настроен или globalSetup упал',
  )

  const TITLE = 'E2E Скрытый из каталога'
  let credentials: TestCredentials
  let releaseId = ''
  let slug = ''

  // Фикстура напрямую в БД: published-релиз со show_in_catalog = false,
  // одна опубликованная книга и owner-коллаборант (тестовый админ).
  test.beforeAll(async () => {
    credentials = loadTestCredentials()!
    loadEnvLocal()
    const url = process.env.DATABASE_URL
    test.skip(!url, 'DATABASE_URL не настроен')

    slug = `e2e-catalog-hidden-${randomBytes(6).toString('hex')}`
    const client = new Client(pgConfig(url!))
    await client.connect()
    try {
      const release = await client.query<{ id: string }>(
        `INSERT INTO releases (title, slug, status, show_in_catalog, release_date)
         VALUES ($1, $2, 'published', FALSE, '2020-01-02')
         RETURNING id`,
        [TITLE, slug],
      )
      releaseId = release.rows[0].id
      await client.query(
        `INSERT INTO editions (release_id, format, slug, status, is_primary)
         VALUES ($1, 'book', $2, 'published', TRUE)`,
        [releaseId, `${slug}-0`],
      )
      await client.query(
        `INSERT INTO release_collaborators (release_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [releaseId, credentials.userId],
      )
    } finally {
      await client.end()
    }
  })

  test.afterAll(async () => {
    if (!releaseId) return
    loadEnvLocal()
    const url = process.env.DATABASE_URL
    if (!url) return
    const client = new Client(pgConfig(url))
    await client.connect()
    try {
      // Издания уезжают каскадом по FK.
      await client.query('DELETE FROM releases WHERE id = $1', [releaseId])
    } finally {
      await client.end()
    }
  })

  test('скрытый релиз не попадает на /releases', async ({ page }) => {
    await page.goto('/releases', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.locator(`a[href="/release/${slug}"]`)).toHaveCount(0)
  })

  test('прямая ссылка /release/[slug] продолжает работать', async ({ page }) => {
    const res = await page.goto(`/release/${slug}`, { waitUntil: 'domcontentloaded' })
    expect(res!.status(), 'HTTP status для прямой ссылки').toBeLessThan(400)
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible()
  })

  test('в Studio форма отражает снятый флаг', async ({ page }) => {
    test.setTimeout(120_000)
    await loginViaMagicToken(page, credentials.email)
    await page.goto(`/studio/releases/${releaseId}`, { waitUntil: 'domcontentloaded' })

    const checkbox = page.getByRole('checkbox', { name: /Показывать в каталоге релизов/ })
    await expect(checkbox).toBeVisible()
    await expect(checkbox).not.toBeChecked()
  })
})
