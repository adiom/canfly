import { test, expect, type Page } from '@playwright/test'
import { Client } from 'pg'
import { loadEnvLocal, pgConfig } from './setup/pg'

/**
 * Регрессия на разделение публичных профилей по ролям (public_role).
 *
 * Reader → личная читательская страница (noindex).
 * Author → витрина автора (индексируется).
 * Editor → публичного профиля нет: для чужих 404.
 *
 * Тест создаёт временных пользователей в БД (нужен DATABASE_URL) и чистит их
 * после. На сервере без БД скипается.
 */

const READER = { login: 'profile-reader-e2e', handle: 'profile_reader_e2e' }
const AUTHOR = { login: 'profile-author-e2e', handle: 'profile_author_e2e' }
const EDITOR = { login: 'profile-editor-e2e', handle: 'profile_editor_e2e' }

async function metaContent(page: Page, name: string): Promise<string | null> {
  const el = page.locator(`meta[name="${name}"]`)
  // Без auto-wait: при noindex=false Next вовсе не рендерит robots-meta.
  return (await el.count()) ? (await el.getAttribute('content')) : null
}

// Загружаем env на уровне модуля: test.skip ниже считается при коллекции,
// когда beforeAll ещё не выполнялся, поэтому DATABASE_URL должен быть виден сразу.
loadEnvLocal()
const url = process.env.DATABASE_URL ?? null

test.beforeAll(async () => {
  if (!url) return

  const client = new Client(pgConfig(url))
  await client.connect()
  try {
    for (const u of [READER, AUTHOR, EDITOR]) {
      // Идемпотентность: удаляем возможные остатки от упавших запусков.
      await client.query(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE login = $1)`,
        [u.login],
      )
      await client.query('DELETE FROM users WHERE login = $1', [u.login])
      await client.query(
        `INSERT INTO users (login, handle, display_name, public_role, is_admin)
         VALUES ($1, $2, $3, $4, $5)`,
        [u.login, u.handle, u.login, u.login === AUTHOR.login ? 'author' : 'reader', false],
      )
    }
    // Editor получает системную роль — без неё публичный профиль был бы обычным.
    await client.query(
      `INSERT INTO user_roles (user_id, role)
       SELECT id, 'editor' FROM users WHERE login = $1
       ON CONFLICT DO NOTHING`,
      [EDITOR.login],
    )
  } finally {
    await client.end()
  }
})

test.afterAll(async () => {
  if (!url) return
  const client = new Client(pgConfig(url))
  await client.connect()
  try {
    for (const u of [READER, AUTHOR, EDITOR]) {
      await client.query(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE login = $1)`,
        [u.login],
      )
      await client.query('DELETE FROM users WHERE login = $1', [u.login])
    }
  } finally {
    await client.end()
  }
})

test.describe('user profile: роли', () => {
  // Один воркер: beforeAll создаёт пользователей в БД, параллельные
  // воркеры гонялись бы за одними и теми же строками (duplicate handle).
  test.describe.configure({ mode: 'serial' })

  test.skip(!url, 'DATABASE_URL не настроен — тест требует БД')

  test('author: витрина и JSON-LD Person', async ({ page }) => {
    const res = await page.goto(`/user/${AUTHOR.handle}`, { waitUntil: 'domcontentloaded' })
    expect(res!.status()).toBe(200)

    await expect(page.getByText(`Автор · @${AUTHOR.handle}`)).toBeVisible()
    await expect(page.getByText('Книги', { exact: true })).toBeVisible()

    const robots = await metaContent(page, 'robots')
    expect(robots ?? '').not.toContain('noindex')

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
    const joined = jsonLd.join(' ')
    expect(joined).toContain('ProfilePage')
    expect(joined).toContain('"Person"')
  })

  test('reader: читательская страница, noindex', async ({ page }) => {
    const res = await page.goto(`/user/${READER.handle}`, { waitUntil: 'domcontentloaded' })
    expect(res!.status()).toBe(200)

    await expect(page.getByText(`Читатель · @${READER.handle}`)).toBeVisible()

    const robots = await metaContent(page, 'robots')
    expect(robots).toContain('noindex')
  })

  test('editor: 404 для чужих', async ({ page }) => {
    const res = await page.goto(`/user/${EDITOR.handle}`, { waitUntil: 'domcontentloaded' })
    // В dev-режиме Next стримит и отдаёт 200 с UI 404 (см. docs not-found:
    // «200 HTTP status code for streamed responses»). Проверяем сам 404-UI,
    // а не статус — иначе тест падал бы только из-за среды.
    expect(res).not.toBeNull()

    await expect(page.getByText('404 · Страница не найдена')).toBeVisible()
    await expect(page.locator('[class*="SignatureBand"]')).toHaveCount(0)
  })
})
