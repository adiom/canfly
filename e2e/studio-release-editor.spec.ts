import { test, expect as baseExpect, type Page } from '@playwright/test'
import { randomBytes, randomInt } from 'node:crypto'
import { Client } from 'pg'
import { del, list } from '@vercel/blob'
import { loadTestCredentials, type TestCredentials } from './setup/credentials'
import { loadEnvLocal, pgConfig } from './setup/pg'

const expect = baseExpect.configure({ timeout: 20_000 })

async function saveForm(page: Page, button: string, form: string, status = 'Изменения сохранены') {
  await page.getByRole('button', { name: button, exact: true }).click()
  await expect(page.getByRole('form', { name: form, exact: true }).getByRole('status')).toHaveText(status, { timeout: 60_000 })
}

async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  loadEnvLocal()
  if (!process.env.DATABASE_URL) throw new Error('Для проверки редактора нужна тестовая БД')
  const client = new Client(pgConfig(process.env.DATABASE_URL))
  await client.connect()
  try { return await run(client) } finally { await client.end() }
}

async function login(page: Page, credentials: TestCredentials) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  const token = randomBytes(32).toString('hex')
  await withDb(client => client.query(
    `INSERT INTO magic_tokens (token, link_token, email, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [String(randomInt(10_000_000, 100_000_000)), token, credentials.email],
  ))
  await page.goto(`/hi/${token}`)
  await page.waitForURL('/profile', { timeout: 30_000 })
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test.describe('studio: paper release editor', () => {
  test.describe.configure({ mode: 'default' })
  let credentials: TestCredentials
  let author: TestCredentials
  let releaseId = ''
  let editionId = ''
  let seriesId = ''
  let characterId = ''
  const createdReleaseIds: string[] = []
  const uploadedUrls: string[] = []
  const unique = randomBytes(5).toString('hex')
  const title = `Бумага ${unique}`
  const slug = `e2e-paper-${unique}`
  const characterName = `Герой Бумаги ${unique}`
  const seriesName = `Серия Бумаги ${unique}`
  const authors = [{ name: 'Тестовый автор', role: 'author' }]

  test.beforeAll(async () => {
    const found = loadTestCredentials()
    if (!found) throw new Error('globalSetup не создал тестового администратора')
    credentials = found
    await withDb(async client => {
      const release = await client.query<{ id: string }>(
        `INSERT INTO releases (title, slug, release_date, authors, show_in_catalog, status)
         VALUES ($1, $2, '2026-03-10', $3::jsonb, false, 'draft') RETURNING id`,
        [title, slug, JSON.stringify(authors)],
      )
      releaseId = release.rows[0].id
      createdReleaseIds.push(releaseId)
      await client.query('UPDATE releases SET design_config = $2::jsonb WHERE id = $1', [releaseId, JSON.stringify({ accent_color: '#28637a', layout: 'sidebar', show_series: false, hero_art: 'canvas' })])
      const edition = await client.query<{ id: string }>(
        `INSERT INTO editions (release_id, slug, format, status) VALUES ($1, $2, 'book', 'draft') RETURNING id`,
        [releaseId, `${slug}-book`],
      )
      editionId = edition.rows[0].id
      const series = await client.query<{ id: string }>('INSERT INTO series (title, slug) VALUES ($1, $2) RETURNING id', [seriesName, `${slug}-series`])
      seriesId = series.rows[0].id
      const character = await client.query<{ id: string }>('INSERT INTO characters (name, slug) VALUES ($1, $2) RETURNING id', [characterName, `${slug}-hero`])
      characterId = character.rows[0].id
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (login, email, handle, display_name, public_role) VALUES ($1, $2, $1, 'Тестовый автор Бумаги', 'author') RETURNING id`,
        [`paper_${unique}`, `paper-${unique}@canfly.test`],
      )
      author = { userId: user.rows[0].id, email: `paper-${unique}@canfly.test` }
    })
  })

  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.startsWith('сохраняет данные')) {
      await withDb(client => client.query("UPDATE releases SET title = $2, slug = $3, status = 'published' WHERE id = $1", [releaseId, `${title} — правки`, `${slug}-saved`]))
    }
    await login(page, credentials)
  })

  test.afterAll(async () => {
    await withDb(async client => {
      if (createdReleaseIds.length) await client.query('DELETE FROM releases WHERE id = ANY($1::uuid[])', [createdReleaseIds])
      if (seriesId) await client.query('DELETE FROM series WHERE id = $1', [seriesId])
      if (characterId) await client.query('DELETE FROM characters WHERE id = $1', [characterId])
      if (author) {
        await client.query('DELETE FROM magic_tokens WHERE email = $1', [author.email])
        await client.query('DELETE FROM users WHERE id = $1', [author.userId])
      }
      if (credentials) await client.query('DELETE FROM magic_tokens WHERE email = $1', [credentials.email])
    })
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Убираем и загрузку, ответ которой тест мог не успеть получить.
      const uploads = await list({ prefix: `e2e-paper-${unique}-`, limit: 100 })
      const urls = [...new Set([...uploadedUrls, ...uploads.blobs.map(blob => blob.url)])]
      if (urls.length) await del(urls)
    }
  })

  test('сохраняет данные, роли и публикацию; использует единый публичный дизайн', async ({ page }) => {
    test.setTimeout(240_000)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/studio/releases/${releaseId}`)
    await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0)
    await expect(page.getByLabel('Дата выпуска', { exact: true })).toHaveValue('2026-03-10')
    await expect(page.getByRole('link', { name: 'Открыть на сайте' })).toHaveCount(0)
    await page.getByLabel('Название', { exact: true }).fill(`${title} — правки`)
    await page.getByLabel('Описание', { exact: true }).fill('Описание, которое сохраняется после смены вкладки.')
    await page.getByLabel('Жанр', { exact: true }).fill('Современная проза')
    await page.getByText('Аннотация и заметки', { exact: true }).click()
    await page.getByLabel('Аннотация', { exact: true }).fill('Аннотация для читателей')
    await page.getByLabel('Заметки редактора', { exact: true }).fill('Личная заметка редактора')
    await page.getByText('ISBN и каталог', { exact: true }).click()
    await page.getByLabel('ISBN', { exact: true }).fill('978-1-234-56789-7')

    await page.getByRole('tab', { name: /Связи/ }).click()
    await choose(page, 'Связать персонажа', characterName)
    await page.getByRole('button', { name: 'Связать', exact: true }).click()
    await choose(page, `Роль: ${characterName}`, 'Главный')
    await expect(page.getByRole('tab', { name: 'Оформление', exact: true })).toHaveCount(0)

    await page.getByRole('tab', { name: 'Основное', exact: true }).click()
    await expect(page.getByLabel('Название', { exact: true })).toHaveValue(`${title} — правки`)
    await expect(page.getByLabel('Заметки редактора', { exact: true })).toHaveValue('Личная заметка редактора')
    await saveForm(page, 'Сохранить основные', 'Основные данные')
    await expect(page.getByRole('button', { name: 'Сохранить основные', exact: true })).toBeDisabled()

    await page.getByRole('tab', { name: /Связи/ }).click()
    await expect(page.getByRole('combobox', { name: `Роль: ${characterName}` })).toHaveText('Главный')
    await saveForm(page, 'Сохранить персонажей', 'Персонажи релиза')
    await expect(page.getByRole('button', { name: 'Сохранить персонажей', exact: true })).toBeDisabled()
    // Каждая роль проходит через настоящий Server Action.
    for (const [label, value] of [['Второстепенный', 'supporting'], ['Камео', 'cameo'], ['Главный', 'main']]) {
      await choose(page, `Роль: ${characterName}`, label)
      await saveForm(page, 'Сохранить персонажей', 'Персонажи релиза')
      await expect.poll(async () => withDb(async client => (await client.query('SELECT role FROM release_characters WHERE release_id = $1 AND character_id = $2', [releaseId, characterId])).rows[0]?.role)).toBe(value)
    }

    await page.getByRole('button', { name: 'Публикация: Черновик' }).click()
    await choose(page, 'Статус', 'Опубликован')
    await page.getByRole('button', { name: 'Применить статус', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Публикация: Опубликован' })).toBeVisible()
    await page.locator('summary').filter({ hasText: /^Серия$/ }).click()
    await choose(page, 'Серия', seriesName)
    await page.getByLabel('Номер фазы', { exact: true }).fill('0')
    await page.getByRole('button', { name: 'Публикация: Опубликован' }).click()
    await expect(page.getByRole('dialog', { name: 'Публикация релиза' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Публикация: Опубликован' }).click()
    await page.locator('summary').filter({ hasText: /^Серия$/ }).click()
    await expect(page.getByLabel('Номер фазы', { exact: true })).toHaveValue('0')
    await saveForm(page, 'Сохранить серию', 'Серия релиза', 'Серия сохранена')
    await expect.poll(async () => withDb(async client => (await client.query('SELECT phase_number FROM release_series WHERE release_id = $1', [releaseId])).rows[0]?.phase_number)).toBe(0)
    await choose(page, 'Серия', 'Без серии')
    await saveForm(page, 'Сохранить серию', 'Серия релиза', 'Серия сохранена')
    await expect.poll(async () => withDb(async client => (await client.query('SELECT series_id FROM release_series WHERE release_id = $1', [releaseId])).rowCount)).toBe(0)
    await choose(page, 'Серия', seriesName)
    await page.getByLabel('Номер фазы', { exact: true }).fill('2')
    await saveForm(page, 'Сохранить серию', 'Серия релиза', 'Серия сохранена')
    await expect(page.getByRole('button', { name: 'Сохранить серию', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Основное', exact: true }).click()
    await page.getByLabel('Адрес страницы', { exact: true }).fill(`${slug}-saved`)
    await expect(page.getByRole('link', { name: 'Открыть на сайте' })).toHaveAttribute('href', `/release/${slug}`)
    await saveForm(page, 'Сохранить основные', 'Основные данные')
    await expect(page.getByRole('link', { name: 'Открыть на сайте' })).toHaveAttribute('href', `/release/${slug}-saved`)
    await page.reload()
    const stored = await withDb(async client => (await client.query('SELECT *, release_date::text AS date_text FROM releases WHERE id = $1', [releaseId])).rows[0])
    expect(stored).toMatchObject({ title: `${title} — правки`, status: 'published', authors, date_text: '2026-03-10', editor_notes: 'Личная заметка редактора', isbn: '978-1-234-56789-7', show_in_catalog: false })
    expect(stored.design_config).toMatchObject({ accent_color: '#28637a', layout: 'sidebar', show_series: false, hero_art: 'canvas' })
    await page.goto(`/release/${slug}-saved`)
    const releaseSurface = page.locator('.release-surface')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} — правки`)
    await expect(page.getByRole('heading', { name: seriesName })).toBeVisible()
    await expect.poll(() => releaseSurface.evaluate(element => {
      const parent = element.parentElement
      return parent ? getComputedStyle(element).getPropertyValue('--cf-accent').trim() === getComputedStyle(parent).getPropertyValue('--cf-accent').trim() : false
    })).toBe(true)
    await expect(page.locator('[data-release-art]')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('обложка: лимит, ошибка, загрузка, замена, сохранение; адаптивность и клавиатура', async ({ page }, testInfo) => {
    test.setTimeout(240_000)
    await page.goto(`/studio/releases/${releaseId}`)
    const fileInput = page.getByLabel('Файл обложки', { exact: true })
    await fileInput.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Файл больше 10 МБ')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1kAAAAASUVORK5CYII=', 'base64')
    for (const suffix of ['first', 'replacement']) {
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/studio/upload') && response.request().method() === 'POST', { timeout: 60_000 })
      await fileInput.setInputFiles({ name: `e2e-paper-${unique}-${suffix}.png`, mimeType: 'image/png', buffer: png })
      const response = await responsePromise
      expect(response.status()).toBe(200)
      const uploaded: { url: string } = await response.json()
      uploadedUrls.push(uploaded.url)
      await expect(page.getByRole('img', { name: 'Обложка релиза', exact: true })).toHaveAttribute('src', uploaded.url)
      await page.getByRole('tab', { name: /Издания/ }).click()
      await page.getByRole('tab', { name: 'Основное', exact: true }).click()
      await saveForm(page, 'Сохранить основные', 'Основные данные')
      await expect.poll(async () => withDb(async client => (await client.query('SELECT cover_image FROM releases WHERE id = $1', [releaseId])).rows[0]?.cover_image)).toBe(uploaded.url)
    }
    await page.getByLabel('Описание', { exact: true }).fill('Правка после сетевой ошибки')
    const editorUrl = `**/studio/releases/${releaseId}`
    await page.route(editorUrl, async route => {
      if (route.request().method() === 'POST') await route.abort('failed')
      else await route.continue()
    })
    await page.getByRole('button', { name: 'Сохранить основные', exact: true }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Не удалось сохранить основные данные')
    await expect(page.getByLabel('Описание', { exact: true })).toHaveValue('Правка после сетевой ошибки')
    await page.unroute(editorUrl)
    await expect(page.getByRole('button', { name: 'Сохранить основные', exact: true })).toBeEnabled()
    await saveForm(page, 'Сохранить основные', 'Основные данные')
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Сохранить основные', exact: true })).toBeDisabled()
    await expect.poll(async () => withDb(async client => (await client.query('SELECT description FROM releases WHERE id = $1', [releaseId])).rows[0]?.description)).toBe('Правка после сетевой ошибки')

    await page.getByRole('tab', { name: 'Основное', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /Издания/ })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    await expect(page.getByRole('tab', { name: 'Готовность', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: 'Основное', exact: true }).click()
    for (const width of [1280, 805, 375, 320]) {
      await page.setViewportSize({ width, height: 900 })
      for (const section of ['Основное', 'Издания', 'Связи', 'Готовность']) {
        await page.getByRole('tab', { name: new RegExp(section) }).click()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${section}, ${width}px`).toBeLessThanOrEqual(0)
        await expect(page.getByRole('img', { name: 'Обложка релиза', exact: true })).toBeVisible()
      }
      await page.getByRole('tab', { name: 'Основное', exact: true }).click()
      if (width < 440) {
        const tabs = page.getByRole('tab')
        expect((await tabs.nth(2).boundingBox())!.y).toBeGreaterThan((await tabs.nth(0).boundingBox())!.y)
      }
      await page.screenshot({ path: testInfo.outputPath(`paper-${width}.png`), fullPage: true })
    }
    const publication = page.getByRole('button', { name: 'Публикация: Опубликован' })
    await publication.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Публикация релиза' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await page.keyboard.press('Escape')
    await expect(publication).toBeFocused()
    await page.getByRole('button', { name: 'Удалить обложку', exact: true }).click()
    await saveForm(page, 'Сохранить основные', 'Основные данные')
    await expect.poll(async () => withDb(async client => (await client.query('SELECT cover_image FROM releases WHERE id = $1', [releaseId])).rows[0]?.cover_image)).toBeNull()
  })

  test('маршруты Studio, создание, защита доступа и подтверждение удаления', async ({ page, browser }) => {
    test.setTimeout(240_000)
    await page.goto(`/studio/releases/${releaseId}`)
    await page.getByRole('tab', { name: /Издания/ }).click()
    await page.locator(`a[href="/studio/editions/${editionId}"]`).click()
    await page.waitForURL(`/studio/editions/${editionId}`)
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible()
    await page.goto(`/studio/releases/${releaseId}`)
    await page.getByRole('tab', { name: /Издания/ }).click()
    await page.getByRole('link', { name: 'Новое издание', exact: true }).click()
    await page.waitForURL(`**/studio/editions/new?releaseId=${releaseId}`)
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible()
    await page.goto(`/studio/releases/${releaseId}`)
    await page.getByRole('link', { name: 'Все релизы', exact: true }).click()
    await page.waitForURL('/studio')
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible()
    await page.goto('/studio/releases/new')
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible()
    await page.getByLabel('Название', { exact: true }).fill(`Новая бумага ${unique}`)
    await expect(page.getByLabel('Slug', { exact: true })).not.toHaveValue('')
    await page.getByLabel('Slug', { exact: true }).fill(`${slug}-new`)
    await page.getByRole('button', { name: 'Создать', exact: true }).click()
    await page.waitForURL(/\/studio\/releases\/[\da-f-]{36}$/)
    const newId = page.url().split('/').pop()!
    createdReleaseIds.push(newId)
    await expect(page.getByRole('heading', { name: `Новая бумага ${unique}`, exact: true })).toBeVisible()
    await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0)

    const guest = await browser.newContext()
    const guestPage = await guest.newPage()
    await guestPage.goto(`/studio/releases/${releaseId}`)
    await expect(guestPage).toHaveURL(/\/(login|studio-access-denied)(\?|$)/)
    await guest.close()
    const outsider = await browser.newContext()
    const outsiderPage = await outsider.newPage()
    await login(outsiderPage, author)
    await outsiderPage.goto(`/studio/releases/${releaseId}`)
    await expect(outsiderPage).toHaveURL(/\/studio$/)
    await withDb(client => client.query("INSERT INTO release_collaborators (release_id, user_id, role) VALUES ($1, $2, 'owner')", [newId, author.userId]))
    await outsiderPage.goto(`/studio/releases/${newId}`)
    await expect(outsiderPage.getByRole('tab', { name: 'Основное', exact: true })).toBeVisible()
    await outsider.close()

    await page.goto(`/studio/releases/${releaseId}`)
    await page.getByRole('button', { name: 'Публикация: Опубликован' }).click()
    await choose(page, 'Статус', 'Архив')
    await page.getByRole('button', { name: 'Применить статус', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Публикация: Архив' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Открыть на сайте' })).toHaveCount(0)
    await choose(page, 'Статус', 'Черновик')
    await page.getByRole('button', { name: 'Применить статус', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Публикация: Черновик' })).toBeVisible()
    await page.getByRole('button', { name: 'Удалить релиз', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Удалить навсегда', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Публикация: Черновик' })).toBeFocused()
    await page.getByRole('button', { name: 'Публикация: Черновик' }).click()
    await page.getByRole('button', { name: 'Удалить релиз', exact: true }).click()
    await page.getByLabel('Введите название релиза для подтверждения').fill(`${title} — правки`)
    await dialog.getByRole('button', { name: 'Удалить навсегда', exact: true }).click()
    await page.waitForURL('/studio')
    await expect.poll(async () => withDb(async client => (await client.query('SELECT id FROM releases WHERE id = $1', [releaseId])).rowCount)).toBe(0)
  })
})
