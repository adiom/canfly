import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { loadTestCredentials } from './setup/credentials'
import { loginViaMagicToken } from './setup/login-helper'
import { loadEnvLocal, pgConfig } from './setup/pg'

loadEnvLocal()

test.describe('reader admin preview', () => {
  test.describe.configure({ mode: 'serial' })
  let releaseId = ''
  let editionId = ''
  const slug = `e2e-reader-preview-${randomUUID()}`

  test.beforeAll(async () => {
    test.skip(!process.env.DATABASE_URL || !loadTestCredentials(), 'Нужна тестовая БД и тестовый администратор')
    const client = new Client(pgConfig(process.env.DATABASE_URL!))
    await client.connect()
    try {
      await client.query('BEGIN')
      const release = await client.query<{ id: string }>(
        `INSERT INTO releases (title, slug, status) VALUES ($1, $2, 'draft') RETURNING id`,
        ['E2E reader preview', slug],
      )
      releaseId = release.rows[0].id
      const edition = await client.query<{ id: string }>(
        `INSERT INTO editions (release_id, slug, format, status) VALUES ($1, $2, 'book', 'draft') RETURNING id`,
        [releaseId, slug],
      )
      editionId = edition.rows[0].id
      await client.query(
        `INSERT INTO chapters (edition_id, title, content, status, chapter_index)
         VALUES ($1, 'Черновая глава', '<p>Секретный текст предпросмотра.</p>', 'draft', 0)`,
        [editionId],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      releaseId = ''
      throw error
    } finally {
      await client.end()
    }
  })

  test.afterAll(async () => {
    if (!releaseId) return
    const client = new Client(pgConfig(process.env.DATABASE_URL!))
    await client.connect()
    try {
      await client.query('DELETE FROM releases WHERE id = $1', [releaseId])
    } finally {
      await client.end()
    }
  })

  test('guest cannot retrieve draft text by slug or UUID', async ({ request }) => {
    for (const identifier of [slug, editionId]) {
      const response = await request.get(`/vvvvv/${identifier}`)
      expect(response.status()).toBe(404)
      expect(await response.text()).not.toContain('Секретный текст предпросмотра')
    }
  })

  test('admin reads draft and sees the mark at desktop and mobile widths', async ({ page }) => {
    await loginViaMagicToken(page, loadTestCredentials()!.email)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      const response = await page.goto(`/vvvvv/${width === 1440 ? slug : editionId}`)
      expect(response!.status()).toBe(200)
      const notice = page.getByRole('complementary', { name: 'Предпросмотр администратора' })
      await expect(notice).toBeVisible()
      await expect(notice).toContainText('Релиз: черновик. Издание: черновик.')
      await expect(notice).toContainText('Неопубликованных глав: 1')
      await expect(page.getByText('Секретный текст предпросмотра.', { exact: true })).toBeVisible()
      const box = await notice.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    }
  })
})
