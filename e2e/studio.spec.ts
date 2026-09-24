import { test, expect, type Page } from '@playwright/test'
import { randomBytes, randomInt } from 'node:crypto'
import { Client } from 'pg'
import { loadTestCredentials, type TestCredentials } from './setup/credentials'
import { loginViaMagicLink } from './setup/login-helper'
import { loadEnvLocal, pgConfig } from './setup/pg'

const STUDIO_ROUTES = ['/studio', '/studio/characters'] as const

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

test.describe('smoke: studio routes (admin role)', () => {
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

  for (const path of STUDIO_ROUTES) {
    test(`GET ${path}`, async ({ page }) => {
      const errors = attachErrorCollectors(page)
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(res!.status(), `HTTP status for ${path}`).toBeLessThan(400)
      await page.waitForLoadState('networkidle').catch(() => {})
      expect(errors, `runtime errors on ${path}:\n${errors.join('\n')}`).toEqual([])
    })
  }

  test('GET first character detail (regression: hydration on /studio/characters/[id])', async ({ page }) => {
    test.setTimeout(60_000)
    const errors = attachErrorCollectors(page)
    await page.goto('/studio/characters', { waitUntil: 'load' })

    const editLink = page.locator('a[href^="/studio/characters/"]').first()
    let href: string | null = null
    try {
      await editLink.waitFor({ state: 'attached', timeout: 25_000 })
      href = await editLink.getAttribute('href')
    } catch {
      test.skip(true, 'no character cards rendered within 25s (dev compile or empty list)')
    }
    test.skip(!href || href === '/studio/characters' || !href.includes('/studio/characters/'), 'no characters to test detail page')

    const res = await page.goto(href!, { waitUntil: 'load' })
    expect(res!.status(), `HTTP status for ${href}`).toBeLessThan(400)
    await page.waitForLoadState('networkidle').catch(() => {})

    expect(
      errors,
      `runtime errors on ${href}:\n${errors.join('\n')}`,
    ).toEqual([])
  })

  test('GET new character form (catches asChild hydration)', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    const res = await page.goto('/studio/characters/new', { waitUntil: 'domcontentloaded' })
    expect(res!.status()).toBeLessThan(400)
    await page.waitForLoadState('networkidle').catch(() => {})
    expect(errors, `runtime errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('GET new character form with type=city', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    const res = await page.goto('/studio/characters/new?type=city', { waitUntil: 'domcontentloaded' })
    expect(res!.status()).toBeLessThan(400)
    await page.waitForLoadState('networkidle').catch(() => {})
    expect(errors, `runtime errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('full page has download dropdown', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/releases', { waitUntil: 'domcontentloaded' })

    const firstLink = page.locator('a[href^="/release/"]').first()
    let href: string | null = null
    try {
      await firstLink.waitFor({ state: 'attached', timeout: 25_000 })
      href = await firstLink.getAttribute('href')
    } catch {
      test.skip(true, 'no releases listed')
    }
    test.skip(!href, 'no release link found')

    await page.goto(href!, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const fullPageLink = page.locator('a[href*="/full"]')
    try {
      await fullPageLink.first().waitFor({ state: 'attached', timeout: 10_000 })
    } catch {
      test.skip(true, 'no full page link on release page')
    }

    const fullHref = await fullPageLink.first().getAttribute('href')
    if (!fullHref) test.skip(true, 'no full page href')

    await page.goto(fullHref!, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const downloadButton = page.locator('button').filter({ hasText: 'Скачать' })
    await expect(downloadButton).toBeVisible({ timeout: 5_000 })
    expect(errors, `runtime errors on full page:\n${errors.join('\n')}`).toEqual([])
  })
})

async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T | null> {
  loadEnvLocal()
  const url = process.env.DATABASE_URL
  if (!url) return null

  const client = new Client(pgConfig(url))
  await client.connect()
  try {
    return await run(client)
  } finally {
    await client.end()
  }
}

/**
 * Вход тестового админа по magic-link токену из БД. UI-helper
 * `loginViaMagicLink` ждёт код на экране, а в текущем логине dev-код в
 * разметку не попадает — здесь ссылка подкладывается напрямую, без почты и
 * лимита «3 письма за 15 минут».
 */
async function loginTestAdminByMagicLink(page: Page, credentials: TestCredentials) {
  // Прогрев cookie: в свежем контексте параллельные /api/auth/session и
  // /api/auth/csrf генерируют каждый свой токен и перезаписывают cookie друг
  // друга — callback падает с MissingCSRF. После /login cookie уже валиден.
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})

  const linkToken = randomBytes(32).toString('hex')

  await withDb((client) =>
    client.query(
      `INSERT INTO magic_tokens (token, link_token, email, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
      [String(randomInt(10_000_000, 100_000_000)), linkToken, credentials.email],
    ),
  )

  await page.goto(`/hi/${linkToken}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('/profile', { timeout: 20_000 })
}

test.describe('smoke: studio news draft', () => {
  test.skip(
    !CREDENTIALS,
    'Test admin не создан — DATABASE_URL не настроен или globalSetup упал',
  )

  let credentials: TestCredentials
  const createdIds: string[] = []

  test.beforeAll(() => {
    credentials = CREDENTIALS!
  })

  test.beforeEach(async ({ page }) => {
    await loginTestAdminByMagicLink(page, credentials)
  })

  // Черновики ссылаются на тестового админа, а globalTeardown удаляет юзера —
  // без уборки teardown упал бы на FK.
  test.afterAll(async () => {
    await withDb(async (client) => {
      if (createdIds.length > 0) {
        await client.query('DELETE FROM news_posts WHERE id = ANY($1::uuid[])', [createdIds])
      }
      await client.query('DELETE FROM magic_tokens WHERE email = $1', [credentials.email])
    })
  })

  test('POST /studio/new создаёт новость и slug из заголовка (регрессия: NOT NULL slug)', async ({ page }) => {
    test.setTimeout(90_000)
    const errors = attachErrorCollectors(page)
    const uniqueTitle = `Тестовая новость ${Date.now()}`

    await page.goto('/studio/new', { waitUntil: 'domcontentloaded' })
    await page.locator('form').filter({ hasText: 'Новость' }).getByRole('button').click()

    await page.waitForURL(/\/studio\/news\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    const newsId = page.url().split('/').pop()!
    createdIds.push(newsId)

    await page.locator('input[placeholder="Заголовок новости"]').fill(uniqueTitle)
    await page.locator('input[placeholder="Заголовок новости"]').blur()
    await expect(page.getByText('Сохранено', { exact: true }).first()).toBeVisible({ timeout: 25_000 })

    const slug = await withDb((client) =>
      client
        .query<{ slug: string }>('SELECT slug FROM news_posts WHERE id = $1', [newsId])
        .then((res) => res.rows[0]?.slug ?? null),
    )

    expect(slug, 'slug черновика должен следовать за заголовком').toMatch(/^testovaya-novost-\d+/)
    expect(errors, `runtime errors:\n${errors.join('\n')}`).toEqual([])
  })
})

test.describe('smoke: chapter nav (стрелки между главами)', () => {
  test.skip(
    !CREDENTIALS,
    'Test admin не создан — DATABASE_URL не настроен или globalSetup упал',
  )

  let credentials: TestCredentials
  let releaseId = ''
  let editionId = ''
  const chapters: { id: string; title: string }[] = []

  // Данные создаются напрямую в БД: релиз-черновик админа, одна книга и три
  // главы. Через UI это стоило бы десяток шагов и не относилось к навигации.
  test.beforeAll(async () => {
    credentials = CREDENTIALS!

    const created = await withDb(async (client) => {
      const stamp = Date.now()
      const release = await client.query<{ id: string }>(
        `INSERT INTO releases (title, slug, status)
         VALUES ($1, $2, 'draft') RETURNING id`,
        ['E2E навигация по главам', `e2e-chapter-nav-release-${stamp}`],
      )
      const edition = await client.query<{ id: string }>(
        `INSERT INTO editions (release_id, format, slug, status)
         VALUES ($1, 'book', $2, 'draft') RETURNING id`,
        [release.rows[0].id, `e2e-chapter-nav-edition-${stamp}`],
      )

      const titles = ['Глава первая', 'Глава вторая', 'Глава третья']
      const inserted = await client.query<{ id: string; title: string }>(
        `INSERT INTO chapters (edition_id, title, chapter_index)
         SELECT $1, title, ordinality
         FROM unnest($2::text[]) WITH ORDINALITY AS t(title, ordinality)
         RETURNING id, title`,
        [edition.rows[0].id, titles],
      )

      return {
        releaseId: release.rows[0].id,
        editionId: edition.rows[0].id,
        // ORDER BY в INSERT … RETURNING не гарантирован — раскладываем по title.
        chapters: titles.map((title) => ({
          id: inserted.rows.find((row) => row.title === title)!.id,
          title,
        })),
      }
    })

    releaseId = created?.releaseId ?? ''
    editionId = created?.editionId ?? ''
    chapters.push(...(created?.chapters ?? []))
  })

  test.afterAll(async () => {
    await withDb(async (client) => {
      if (releaseId) {
        // Издания и главы уезжают каскадом по FK.
        await client.query('DELETE FROM releases WHERE id = $1', [releaseId])
      }
      await client.query('DELETE FROM magic_tokens WHERE email = $1', [credentials.email])
    })
  })

  test('переход вперёд/назад не подменяет контент главы', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = attachErrorCollectors(page)
    await loginTestAdminByMagicLink(page, credentials)

    const chapterUrl = (index: number) => `/studio/editions/${editionId}/chapters/${chapters[index].id}`
    const titleInput = page.locator('input[placeholder="Заголовок главы"]')
    const prevArrow = () => page.locator('[aria-label^="Предыдущая глава"]')
    const nextArrow = () => page.locator('[aria-label^="Следующая глава"]')
    const urlPattern = (index: number) => new RegExp(`${chapterUrl(index)}$`)

    await page.goto(chapterUrl(0), { waitUntil: 'domcontentloaded' })
    await expect(titleInput).toHaveValue(chapters[0].title, { timeout: 30_000 })

    // У первой главы назад идти некуда: стрелка на месте, но выключена.
    await expect(page.locator('button[aria-label^="Предыдущая глава"][disabled]')).toBeVisible()
    await expect(nextArrow()).toHaveAttribute('href', chapterUrl(1))
    // Соседи стоят рядом с кнопками формата и версий.
    await expect(page.getByRole('button', { name: 'HTML', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Версии' })).toBeVisible()

    await nextArrow().click()
    await expect(page).toHaveURL(urlPattern(1), { timeout: 30_000 })
    // Ключ `key` на редакторе обязателен: без него состояние Tiptap
    // осталось бы от предыдущей главы и автосейв затёр бы чужой текст.
    await expect(titleInput).toHaveValue(chapters[1].title, { timeout: 30_000 })

    await nextArrow().click()
    await expect(page).toHaveURL(urlPattern(2), { timeout: 30_000 })
    await expect(titleInput).toHaveValue(chapters[2].title, { timeout: 30_000 })
    await expect(page.locator('button[aria-label^="Следующая глава"][disabled]')).toBeVisible()

    await prevArrow().click()
    await expect(page).toHaveURL(urlPattern(1), { timeout: 30_000 })
    await expect(titleInput).toHaveValue(chapters[1].title, { timeout: 30_000 })

    expect(errors, `runtime errors:\n${errors.join('\n')}`).toEqual([])
  })
})

test.describe('smoke: edition markdown', () => {
  test('published edition markdown endpoint returns text', async ({ page }) => {
    await page.goto('/releases', { waitUntil: 'domcontentloaded' })

    const editionLink = page.locator('a[href^="/vvvvv/"]').first()
    try {
      await editionLink.waitFor({ state: 'attached', timeout: 25_000 })
    } catch {
      test.skip(true, 'no published edition listed')
    }

    const href = await editionLink.getAttribute('href')
    if (!href) test.skip(true, 'no published edition href')

    const markdownHref = `${href!}.md`
    const response = await page.request.get(markdownHref)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/markdown')
    expect(await response.text()).toContain('# ')
  })
})
