import { test, expect, type Page } from '@playwright/test'
import { Client } from 'pg'
import { loadEnvLocal, pgConfig } from './setup/pg'

/**
 * Регрессия на публикацию игр (`/games`).
 *
 * Ключевое, что здесь проверяется: страница-обёртка встраивает игру через
 * iframe с того же домена. Глобальные `frame-ancestors 'none'` и
 * `X-Frame-Options: DENY` запрещали бы это, поэтому для точки входа игры они
 * ослаблены — если кто-то вернёт их назад, браузер молча покажет пустой блок,
 * и только этот тест это поймает.
 *
 * Тесты на страницы требуют БД (нужен `DATABASE_URL`), тесты на файлы — нет.
 */

loadEnvLocal()
const url = process.env.DATABASE_URL ?? null

const RUN = Date.now().toString(36)
const PUBLISHED_SLUG = `e2e-game-${RUN}`
const DRAFT_SLUG = `e2e-game-draft-${RUN}`

/** Игра с реальными файлами в репозитории — на ней проверяем встраивание. */
const SAMPLE_SLUG = 'quantum-clash'

/** Файлы игр, которые обязаны лежать в public/games и не тянуть внешние CDN. */
const GAME_FILES: Array<{ slug: string; marker: string }> = [
  { slug: 'quantum-clash', marker: 'ABSURD TGC QUANTUM' },
  { slug: 'still-road', marker: 'STILL ROAD' },
]

const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /Next\.js detected\./i,
]

let createdSample = false
let samplePublished = false
let linkedCharacter: { name: string; slug: string } | null = null

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T | null> {
  if (!url) return null
  const client = new Client(pgConfig(url))
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// Файл держим последовательным: `beforeAll` готовит общие для всех тестов строки
// в БД, а параллельные воркеры гонялись бы за один и тот же slug.
test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await withClient(async (client) => {
    // Идемпотентность: подчищаем возможные остатки от упавших прогонов.
    await client.query('DELETE FROM games WHERE slug = ANY($1::text[])', [
      [PUBLISHED_SLUG, DRAFT_SLUG],
    ])

    const published = await client.query<{ id: string }>(
      `INSERT INTO games (title, slug, tagline, description, aspect_ratio, is_published)
       VALUES ($1, $2, $3, $4, '16:9', TRUE)
       RETURNING id`,
      ['E2E Game', PUBLISHED_SLUG, 'Теговая строка', 'Описание тестовой игры'],
    )

    await client.query(
      `INSERT INTO games (title, slug, is_published) VALUES ($1, $2, FALSE)`,
      ['E2E Draft Game', DRAFT_SLUG],
    )

    const character = await client.query<{ id: string; name: string; slug: string }>(
      `SELECT id, name, slug FROM characters
       WHERE character_type = 'person'
       ORDER BY created_at
       LIMIT 1`,
    )
    if (character.rows.length > 0) {
      linkedCharacter = { name: character.rows[0].name, slug: character.rows[0].slug }
      await client.query(
        `INSERT INTO character_games (game_id, character_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [published.rows[0].id, character.rows[0].id],
      )
    }

    const created = await client.query<{ id: string }>(
      `INSERT INTO games (title, slug, tagline, aspect_ratio, display_order, is_published)
       VALUES ($1, $2, $3, '16:9', 0, TRUE)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      ['ABSURD TGC QUANTUM', SAMPLE_SLUG, 'Карточная игра о Стандартной модели'],
    )

    if (created.rows.length > 0) {
      // Строку создали мы — её и уберём. Чужую запись из Studio не трогаем.
      createdSample = true
      samplePublished = true
    } else {
      const existing = await client.query<{ is_published: boolean }>(
        'SELECT is_published FROM games WHERE slug = $1',
        [SAMPLE_SLUG],
      )
      samplePublished = existing.rows[0]?.is_published ?? false
    }
  })
})

test.afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM games WHERE slug = ANY($1::text[])', [
      [PUBLISHED_SLUG, DRAFT_SLUG],
    ])
    // Удаляем только то, что создали сами: настоящую запись из Studio не трогаем.
    if (createdSample) await client.query('DELETE FROM games WHERE slug = $1', [SAMPLE_SLUG])
  })
})

test.describe('games: файлы игр', () => {
  for (const game of GAME_FILES) {
    test(`${game.slug}: файл отдаётся и не тянет внешние домены`, async ({ page }) => {
      const errors: string[] = []
      const hosts = new Set<string>()

      page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        if (IGNORED_CONSOLE_PATTERNS.some(re => re.test(message.text()))) return
        errors.push(`[console.error] ${message.text()}`)
      })
      page.on('request', (request) => hosts.add(new URL(request.url()).host))

      const response = await page.goto(`/games/${game.slug}/index.html`, {
        waitUntil: 'domcontentloaded',
      })
      expect(response!.status()).toBe(200)
      await page.waitForLoadState('networkidle').catch(() => {})

      await expect(page.locator('body')).toContainText(game.marker)
      // Внешние шрифты/скрипты CSP всё равно заблокирует, но игра должна быть
      // автономной: единственный хост в запросах — сам сайт.
      expect([...hosts], `external hosts on ${game.slug}`).toEqual([
        new URL(page.url()).host,
      ])
      expect(errors, `runtime errors on ${game.slug}:\n${errors.join('\n')}`).toEqual([])
    })
  }

  test('шрифты вендорены локально', async ({ request }) => {
    for (const game of GAME_FILES) {
      const css = await request.get(`/games/${game.slug}/fonts/fonts.css`)
      expect(css.status(), `fonts.css for ${game.slug}`).toBe(200)
      expect(await css.text()).toContain("url(./")

      const html = await request.get(`/games/${game.slug}/index.html`)
      const body = await html.text()
      expect(body).toContain('fonts/fonts.css')
      expect(body).not.toMatch(/https?:\/\//)
    }
  })

  test('заголовки: файл игры можно встроить, страницы — нет', async ({ request }) => {
    const file = await request.get('/games/quantum-clash/index.html')
    expect(file.status()).toBe(200)
    expect(file.headers()['x-frame-options']).toBe('SAMEORIGIN')
    expect(file.headers()['content-security-policy']).toContain("frame-ancestors 'self'")
    expect(file.headers()['x-robots-tag']).toContain('noindex')

    const catalog = await request.get('/games')
    expect(catalog.status()).toBe(200)
    expect(catalog.headers()['x-frame-options']).toBe('DENY')
    expect(catalog.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  })
})

test.describe('games: страницы и связи', () => {
  test.skip(!url, 'DATABASE_URL не настроен — тест требует БД')

  test('каталог показывает опубликованную игру и не показывает черновик', async ({ page }) => {
    const response = await page.goto('/games', { waitUntil: 'domcontentloaded' })
    expect(response!.status()).toBe(200)

    await expect(page.locator(`a[href="/games/${PUBLISHED_SLUG}"]`)).toBeVisible()
    await expect(page.locator(`a[href="/games/${DRAFT_SLUG}"]`)).toHaveCount(0)
  })

  test('страница игры: iframe, песочница и связи', async ({ page }) => {
    const response = await page.goto(`/games/${PUBLISHED_SLUG}`, {
      waitUntil: 'domcontentloaded',
    })
    expect(response!.status()).toBe(200)

    const iframe = page.locator('iframe')
    await expect(iframe).toHaveAttribute('src', `/games/${PUBLISHED_SLUG}/index.html`)
    const sandbox = await iframe.getAttribute('sandbox')
    expect(sandbox).toContain('allow-scripts')
    // allow-same-origin нужен: игра сохраняет прогресс в localStorage.
    expect(sandbox).toContain('allow-same-origin')

    await expect(page.getByRole('button', { name: 'На весь экран' })).toBeVisible()
    await expect(page.locator(`a[href="/games/${PUBLISHED_SLUG}/index.html"]`)).toBeVisible()

    if (linkedCharacter) {
      await expect(page.locator(`a[href="/characters/${linkedCharacter.slug}"]`)).toBeVisible()
    }
  })

  test('черновик и несуществующий слаг → 404', async ({ page }) => {
    const draft = await page.goto(`/games/${DRAFT_SLUG}`, { waitUntil: 'domcontentloaded' })
    expect(draft!.status()).toBe(404)

    const missing = await page.goto('/games/no-such-game-here', { waitUntil: 'domcontentloaded' })
    expect(missing!.status()).toBe(404)
  })

  test('игра реально запускается внутри iframe', async ({ page }) => {
    test.skip(!samplePublished, `${SAMPLE_SLUG} не опубликована в БД`)

    const frameErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') frameErrors.push(message.text())
    })

    const response = await page.goto(`/games/${SAMPLE_SLUG}`, { waitUntil: 'domcontentloaded' })
    expect(response!.status()).toBe(200)

    const frame = page.frameLocator('iframe')
    await expect(frame.locator('#game-container')).toBeAttached()
    await expect(frame.locator('#menu-screen')).toBeVisible({ timeout: 15_000 })
    await frame.locator('#start-btn').click()
    await expect(frame.locator('#game-screen')).toBeVisible({ timeout: 15_000 })

    expect(frameErrors).toEqual([])
  })
})
