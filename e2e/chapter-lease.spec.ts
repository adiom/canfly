import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { expect, test as base, type Page } from '@playwright/test'
import { loadTestCredentials } from './setup/credentials'
import { requireE2eDatabaseUrl } from './setup/environment'
import { pgConfig } from './setup/pg'

const original = '<p>Текст под блокировкой</p>'

interface Sandbox {
  db: Client
  chapterId: string
  chapterUrl: string
  owner: { id: string; email: string; page: Page }
  collaborator: { id: string; email: string }
  newPageFor: (email: string) => Promise<Page>
}

async function createUser(db: Client, label: string) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const email = `lease-${label}-${suffix}@canfly.test`
  const login = `lease_${label}_${suffix}`
  const { rows: [user] } = await db.query<{ id: string }>(
    `INSERT INTO users (login, email, handle, display_name, public_role)
     VALUES ($1, $2, $1, $3, 'author') RETURNING id`,
    [login, email, `Lease ${label}`],
  )
  return { id: user.id, email }
}

async function loginAs(page: Page, db: Client, email: string) {
  const linkToken = randomBytes(32).toString('hex')
  await db.query(
    "INSERT INTO magic_tokens (token, link_token, email, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')",
    [String(randomInt(10_000_000, 100_000_000)), linkToken, email],
  )
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await page.goto(`/hi/${linkToken}`, { waitUntil: 'domcontentloaded' })
  await expect.poll(async () => {
    const response = await page.request.get('/api/auth/session')
    const session = await response.json() as { user?: { email?: string } } | null
    return session?.user?.email
  }, { timeout: 20_000 }).toBe(email)
}

async function waitForEditable(page: Page) {
  await expect(page.locator('[contenteditable="true"]')).toBeVisible({ timeout: 20_000 })
}

async function waitForReadOnly(page: Page, holder?: string) {
  const banner = page.getByRole('alert').filter({ hasText: 'Глава уже редактируется' })
  await expect(banner).toBeVisible({ timeout: 20_000 })
  if (holder) await expect(banner).toContainText(holder)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
}

async function waitForLeaseReleased(db: Client, chapterId: string) {
  await expect.poll(async () => {
    const { rows: [row] } = await db.query<{ live: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM chapter_edit_leases WHERE chapter_id = $1 AND expires_at > now()) AS live',
      [chapterId],
    )
    return row.live
  }, { timeout: 20_000 }).toBe(false)
}

const test = base.extend<{ sandbox: Sandbox }>({
  sandbox: async ({ browser }, applyFixture) => {
    const db = new Client(pgConfig(requireE2eDatabaseUrl()))
    await db.connect()
    const slug = `chapter-lease-${randomUUID()}`
    const owner = await createUser(db, 'owner')
    const collaborator = await createUser(db, 'second')
    const contexts = []
    try {
      const { rows: [release] } = await db.query<{ id: string }>(
        "INSERT INTO releases (title, slug, status) VALUES ($1, $1, 'draft') RETURNING id", [slug],
      )
      const { rows: [edition] } = await db.query<{ id: string }>(
        "INSERT INTO editions (release_id, format, slug, status) VALUES ($1, 'book', $2, 'draft') RETURNING id",
        [release.id, slug],
      )
      const { rows: [chapter] } = await db.query<{ id: string }>(
        "INSERT INTO chapters (edition_id, title, content, chapter_index) VALUES ($1, 'Глава', $2, 1) RETURNING id",
        [edition.id, original],
      )
      for (const user of [owner, collaborator]) {
        await db.query(
          "INSERT INTO release_collaborators (release_id, user_id, role) VALUES ($1, $2, 'owner')",
          [release.id, user.id],
        )
      }

      const ownerContext = await browser.newContext()
      contexts.push(ownerContext)
      const ownerPage = await ownerContext.newPage()
      await loginAs(ownerPage, db, owner.email)
      const chapterUrl = `/studio/editions/${edition.id}/chapters/${chapter.id}`
      await ownerPage.goto(chapterUrl, { waitUntil: 'domcontentloaded' })
      await waitForEditable(ownerPage)

      await applyFixture({
        db,
        chapterId: chapter.id,
        chapterUrl,
        owner: { ...owner, page: ownerPage },
        collaborator,
        newPageFor: async (email: string) => {
          const context = await browser.newContext()
          contexts.push(context)
          const page = await context.newPage()
          await loginAs(page, db, email)
          return page
        },
      })
    } finally {
      for (const context of contexts) await context.close()
      await db.query('DELETE FROM releases WHERE slug = $1', [slug])
      await db.query('DELETE FROM magic_tokens WHERE email = ANY($1::text[])', [[owner.email, collaborator.email]])
      await db.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[owner.id, collaborator.id]])
      await db.end()
    }
  },
})

test.use({ channel: 'chromium' })

test.describe('Эксклюзивное редактирование главы', () => {
  test('второй автор получает чтение, а после освобождения — редактирование', async ({ sandbox }) => {
    const second = await sandbox.newPageFor(sandbox.collaborator.email)
    await second.goto(sandbox.chapterUrl, { waitUntil: 'domcontentloaded' })
    await waitForReadOnly(second, 'Lease owner')

    await sandbox.owner.page.goto('/studio', { waitUntil: 'domcontentloaded' })
    await waitForLeaseReleased(sandbox.db, sandbox.chapterId)

    await second.getByRole('button', { name: 'Попробовать снова' }).click()
    await waitForEditable(second)
    await second.locator('[contenteditable=true]').fill('Правка второго автора')
    await expect(second.getByRole('status')).toContainText('Сохранено')
    const { rows: [saved] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
    )
    expect(saved.content).toBe('<p>Правка второго автора</p>')
  })

  test('администратор не обходит чужой lease', async ({ sandbox }) => {
    const admin = loadTestCredentials()
    if (!admin) throw new Error('Missing isolated Playwright admin')
    const adminPage = await sandbox.newPageFor(admin.email)
    await adminPage.goto(sandbox.chapterUrl, { waitUntil: 'domcontentloaded' })
    await waitForReadOnly(adminPage, 'Lease owner')

    const { rows: [state] } = await sandbox.db.query(
      'SELECT actor_kind, user_id FROM chapter_edit_leases WHERE chapter_id = $1', [sandbox.chapterId],
    )
    expect(state).toEqual({ actor_kind: 'studio', user_id: sandbox.owner.id })

    await sandbox.owner.page.locator('[contenteditable=true]').fill('Текст владельца')
    await expect(sandbox.owner.page.getByRole('status')).toContainText('Сохранено')
  })

  test('истёкший lease освобождает главу, а старая вкладка становится только для чтения', async ({ sandbox }) => {
    await sandbox.db.query(
      `UPDATE chapter_edit_leases
       SET acquired_at = now() - INTERVAL '2 minutes', expires_at = now() - INTERVAL '1 minute'
       WHERE chapter_id = $1`,
      [sandbox.chapterId],
    )

    const second = await sandbox.newPageFor(sandbox.collaborator.email)
    await second.goto(sandbox.chapterUrl, { waitUntil: 'domcontentloaded' })
    await waitForEditable(second)
    await second.locator('[contenteditable=true]').fill('Текст после истечения TTL')
    await expect(second.getByRole('status')).toContainText('Сохранено')
    const { rows: [saved] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
    )
    expect(saved.content).toBe('<p>Текст после истечения TTL</p>')

    await expect(sandbox.owner.page.getByRole('alert').filter({ hasText: /Право редактирования потеряно|Глава уже редактируется/ }))
      .toBeVisible({ timeout: 30_000 })
    await expect(sandbox.owner.page.locator('[contenteditable="true"]')).toHaveCount(0)
  })

  test('поздний дубликат вкладки не перехватывает lease', async ({ sandbox }) => {
    const original = sandbox.owner.page
    const sessionId = await original.evaluate(() => sessionStorage.getItem('cf-editor-session-id'))
    expect(sessionId).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 3_000))

    const duplicate = await original.context().newPage()
    try {
      await duplicate.goto(sandbox.chapterUrl, { waitUntil: 'domcontentloaded' })
      await duplicate.evaluate(
        id => sessionStorage.setItem('cf-editor-session-id', id as string),
        sessionId as string,
      )
      await duplicate.reload({ waitUntil: 'domcontentloaded' })
      await waitForReadOnly(duplicate, 'Lease owner')

      await original.locator('[contenteditable=true]').fill('Текст после позднего дублирования')
      await expect(original.getByRole('status')).toContainText('Сохранено')
      const { rows: [saved] } = await sandbox.db.query(
        'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
      )
      expect(saved.content).toBe('<p>Текст после позднего дублирования</p>')
    } finally {
      await duplicate.close()
    }
  })
})
