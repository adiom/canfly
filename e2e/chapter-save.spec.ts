import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { expect, test as base } from '@playwright/test'
import { loadTestCredentials } from './setup/credentials'
import { requireE2eDatabaseUrl } from './setup/environment'
import { pgConfig } from './setup/pg'
import { callChapterMcp } from './setup/chapter-mcp'

const original = '<p>Исходный текст</p>'
const restored = '<p>Восстановленный текст</p>'
const test = base.extend<{ chapter: { url: string; db: Client; id: string } }>({
  chapter: async ({ page }, runChapterTest) => {
    const admin = loadTestCredentials()
    if (!admin) throw new Error('Missing isolated Playwright admin')
    const slug = `chapter-save-${randomUUID()}`
    const db = new Client(pgConfig(requireE2eDatabaseUrl()))
    await db.connect()
    try {
      const { rows: [release] } = await db.query<{ id: string }>(
        "INSERT INTO releases (title, slug, status) VALUES ($1, $1, 'draft') RETURNING id", [slug],
      )
      const { rows: [edition] } = await db.query<{ id: string }>(
        "INSERT INTO editions (release_id, format, slug, status) VALUES ($1, 'book', $2, 'draft') RETURNING id",
        [release.id, slug],
      )
      const { rows: [row] } = await db.query<{ id: string }>(
        "INSERT INTO chapters (edition_id, title, content, chapter_index) VALUES ($1, 'Глава', $2, 1) RETURNING id",
        [edition.id, original],
      )
      const linkToken = randomBytes(32).toString('hex')
      await db.query(
        "INSERT INTO magic_tokens (token, link_token, email, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')",
        [String(randomInt(10_000_000, 100_000_000)), linkToken, admin.email],
      )
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')
      await page.goto(`/hi/${linkToken}`, { waitUntil: 'domcontentloaded' })
      await expect.poll(async () => {
        const response = await page.request.get('/api/auth/session')
        const session = await response.json() as { user?: { email?: string } } | null
        return session?.user?.email
      }, { timeout: 20_000 }).toBe(admin.email)
      const url = `/studio/editions/${edition.id}/chapters/${row.id}`
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await expect(page.getByPlaceholder('Заголовок главы')).toHaveValue('Глава')
      await runChapterTest({ url, db, id: row.id })
    } finally {
      await db.query('DELETE FROM releases WHERE slug = $1', [slug])
      await db.end()
    }
  },
})

test.use({ channel: 'chromium' })

test.describe('Защита сохранения главы', () => {
  test('поздний заголовок не перезаписывает текст второй вкладки', async ({ chapter, page, context }) => {
    const second = await context.newPage()
    await second.goto(chapter.url, { waitUntil: 'domcontentloaded' })
    await second.locator('[contenteditable=true]').fill('Новый текст из второй вкладки')
    await expect(second.getByRole('status')).toContainText('Сохранено')

    await page.getByPlaceholder('Заголовок главы').fill('Устаревший заголовок')
    await expect(page.getByRole('status')).toContainText('Глава изменилась')
    await expect(page.getByRole('status')).not.toContainText('Сохранено')
    const { rows: [saved] } = await chapter.db.query('SELECT title, content FROM chapters WHERE id = $1', [chapter.id])
    expect(saved).toEqual({ title: 'Глава', content: '<p>Новый текст из второй вкладки</p>' })
  })

  test('отклоняет пустой заголовок и запись после удаления', async ({ chapter, page }) => {
    const title = page.getByPlaceholder('Заголовок главы')
    const status = page.getByRole('status')
    await title.fill('   ')
    await expect(status).toContainText('Введите заголовок главы')
    await expect(status).not.toContainText('Сохранено')
    await chapter.db.query('DELETE FROM chapters WHERE id = $1', [chapter.id])
    await title.fill('Позднее изменение')
    await expect(status).toContainText('Глава удалена')
    await expect(status).not.toContainText('Сохранено')
  })

  test('сохраняет текст с пустым заголовком и восстанавливает незавершённое поле при перезагрузке', async ({ chapter, page }) => {
    const title = page.getByPlaceholder('Заголовок главы')
    await title.fill('')
    await page.locator('[contenteditable=true]').fill('Текст при пустом заголовке')
    await expect(page.getByRole('status')).toContainText('Введите заголовок главы')
    await expect.poll(async () => {
      const { rows: [row] } = await chapter.db.query('SELECT title, content FROM chapters WHERE id = $1', [chapter.id])
      return row
    }).toEqual({ title: 'Глава', content: '<p>Текст при пустом заголовке</p>' })
    await expect(page.getByRole('status')).not.toContainText('Сохранено')
    await expect(page.getByRole('status')).not.toContainText('Сохраняю')
    page.once('dialog', dialog => dialog.accept())
    await page.reload()
    await expect(title).toHaveValue('')
    await expect(page.locator('[contenteditable=true]')).toHaveText('Текст при пустом заголовке')
  })

  test('хранит конфликтующий черновик при новой записи и восстанавливает его только по выбору автора', async ({ chapter, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await chapter.db.query('UPDATE chapters SET content = $2 WHERE id = $1', [chapter.id, '<p>Свежий текст</p>'])
    await page.locator('[contenteditable=true]').fill('Текст из старой вкладки')
    await expect(page.getByRole('status')).toContainText('Глава изменилась')
    page.once('dialog', dialog => dialog.accept())
    await page.reload()
    const editor = page.locator('[contenteditable=true]')
    await expect(editor).toHaveText('Свежий текст')
    await editor.fill('Новая правка')
    await expect(page.getByRole('status')).toContainText('Сохранено')
    await page.reload()
    await expect(editor).toHaveText('Новая правка')
    await page.getByRole('button', { name: 'Локальные черновики' }).click()
    await expect(page.getByLabel('HTML черновика')).toHaveValue('<p>Текст из старой вкладки</p>')
    await page.getByRole('button', { name: 'Скопировать HTML' }).click()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('<p>Текст из старой вкладки</p>')
    await page.getByRole('button', { name: 'Восстановить и сохранить текст' }).click()
    await expect(editor).toHaveText('Текст из старой вкладки')
    await expect(page.getByRole('status')).toContainText('Сохранено')
    const { rows: [row] } = await chapter.db.query('SELECT content FROM chapters WHERE id = $1', [chapter.id])
    expect(row.content).toBe('<p>Текст из старой вкладки</p>')
    await page.getByRole('button', { name: 'Локальные черновики' }).click()
    await expect(page.getByLabel('HTML черновика')).toHaveValue('<p>Текст из старой вкладки</p>')
    await page.getByRole('button', { name: 'Удалить черновик' }).click()
    await expect(page.getByText('Архивных черновиков нет.')).toBeVisible()
  })

  test('записи Studio и MCP с одной ревизией имеют одного победителя', async ({ chapter, page }) => {
    const studioText = 'Правка из Studio'
    const mcpText = '<p>Правка из MCP</p>'
    await chapter.db.query('BEGIN')
    let mcpWrite: ReturnType<typeof callChapterMcp>
    try {
      const { rows: [row] } = await chapter.db.query<{ revision: number }>(
        'SELECT revision FROM chapters WHERE id = $1 FOR UPDATE', [chapter.id],
      )
      const studioRequest = page.waitForRequest(request =>
        request.method() === 'POST' && new URL(request.url()).pathname === chapter.url,
      )
      await page.locator('[contenteditable=true]').fill(studioText)
      await studioRequest
      mcpWrite = callChapterMcp('canfly_update_chapter_v2', {
        id: chapter.id, expected_revision: row.revision, content: mcpText,
      })
    } finally {
      await chapter.db.query('COMMIT')
    }

    const mcp = await mcpWrite
    if (mcp.isError) expect(mcp.structuredContent).toMatchObject({ code: 'conflict' })
    await expect(page.getByRole('status')).toContainText(mcp.isError ? 'Сохранено' : 'Глава изменилась')
    const { rows: [row] } = await chapter.db.query(
      'SELECT content, revision FROM chapters WHERE id = $1', [chapter.id],
    )
    expect(row).toEqual({ content: mcp.isError ? `<p>${studioText}</p>` : mcpText, revision: 1 })
    const { rows: history } = await chapter.db.query(
      'SELECT content FROM chapter_versions WHERE chapter_id = $1', [chapter.id],
    )
    expect(history).toEqual([{ content: original }])
  })

  test('переносит черновик PR1 без привязки к автору в архив без автозаписи', async ({ chapter, page }) => {
    await page.evaluate(({ id, content }) => {
      sessionStorage.setItem(`cf-chapter-draft:${id}`, JSON.stringify({
        version: 1, revision: 0,
        base: JSON.stringify({ title: 'Глава', content }),
        value: { title: 'Глава', content: '<p>Старый локальный черновик</p>' },
      }))
    }, { id: chapter.id, content: original })
    await page.reload()
    await expect(page.locator('[contenteditable=true]')).toHaveText('Исходный текст')
    await page.getByRole('button', { name: 'Локальные черновики' }).click()
    await expect(page.getByLabel('HTML черновика')).toHaveValue('<p>Старый локальный черновик</p>')
    const { rows: [row] } = await chapter.db.query(
      'SELECT content, revision FROM chapters WHERE id = $1', [chapter.id],
    )
    expect(row).toEqual({ content: original, revision: 0 })
  })

  test('откат синхронизирует редактор и следующий патч заголовка', async ({ chapter, page }) => {
    await chapter.db.query(
      'INSERT INTO chapter_versions (chapter_id, content, version_number) VALUES ($1, $2, 1)',
      [chapter.id, restored],
    )
    await page.getByRole('button', { name: 'Версии' }).click()
    await page.getByRole('button', { name: 'Восстановить', exact: true }).click()
    await expect(page.getByText('Версия восстановлена', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[contenteditable=true]')).toHaveText('Восстановленный текст')
    await page.getByPlaceholder('Заголовок главы').fill('Новый заголовок')
    await expect(page.getByRole('status')).toContainText('Сохранено')
    const { rows: [saved] } = await chapter.db.query('SELECT title, content FROM chapters WHERE id = $1', [chapter.id])
    expect(saved).toEqual({ title: 'Новый заголовок', content: restored })
  })
})
