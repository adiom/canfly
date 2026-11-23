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
  editionId: string
  releaseId: string
  comicId: string
  comicUrl: string
  comicContent: string
  audioId: string
  audioUrl: string
  audioTitle: string
  owner: { id: string; email: string; page: Page }
  collaborator: { id: string; email: string }
  newPageFor: (email: string) => Promise<Page>
}

async function expireLease(db: Client, chapterId: string) {
  await db.query(
    `UPDATE chapter_edit_leases
     SET acquired_at = now() - INTERVAL '2 minutes', expires_at = now() - INTERVAL '1 minute'
     WHERE chapter_id = $1`,
    [chapterId],
  )
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

async function waitForLost(page: Page) {
  await expect(page.getByRole('alert').filter({ hasText: 'Право редактирования потеряно' }))
    .toBeVisible({ timeout: 30_000 })
}

async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

async function waitForComicEditing(page: Page) {
  await expect(page.getByRole('button', { name: /^(Загрузить|Восстановить страницы)$/ }).first())
    .toBeEnabled({ timeout: 20_000 })
  await expect(page.getByAltText('Страница 1')).toBeVisible()
}

async function waitForAudioEditing(page: Page) {
  await expect(page.getByRole('button', { name: /^(Сохранить|Восстановить поля)$/ }).first())
    .toBeEnabled({ timeout: 20_000 })
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
      const { rows: [comicEdition] } = await db.query<{ id: string }>(
        "INSERT INTO editions (release_id, format, slug, status) VALUES ($1, 'comic', $2, 'draft') RETURNING id",
        [release.id, `${slug}-comic`],
      )
      const comicContent = JSON.stringify(['/placeholder.jpg', '/placeholder-user.jpg'])
      const { rows: [comicChapter] } = await db.query<{ id: string }>(
        "INSERT INTO chapters (edition_id, title, content, chapter_index) VALUES ($1, 'Комикс', $2, 1) RETURNING id",
        [comicEdition.id, comicContent],
      )
      const { rows: [audioEdition] } = await db.query<{ id: string }>(
        "INSERT INTO editions (release_id, format, slug, status) VALUES ($1, 'audiobook', $2, 'draft') RETURNING id",
        [release.id, `${slug}-audio`],
      )
      const audioTitle = 'Аудио глава'
      const { rows: [audioChapter] } = await db.query<{ id: string }>(
        `INSERT INTO chapters (edition_id, title, chapter_index, audio_metadata)
         VALUES ($1, $2, 1, '{"artist":"Автор"}') RETURNING id`,
        [audioEdition.id, audioTitle],
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
        editionId: edition.id,
        releaseId: release.id,
        comicId: comicChapter.id,
        comicUrl: `/studio/editions/${comicEdition.id}/chapters/${comicChapter.id}`,
        comicContent,
        audioId: audioChapter.id,
        audioUrl: `/studio/editions/${audioEdition.id}/chapters/${audioChapter.id}`,
        audioTitle,
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

  test('H4: дубликат без BroadcastChannel ACK не перехватывает lease', async ({ sandbox }) => {
    const original = sandbox.owner.page
    const sessionId = await original.evaluate(() => sessionStorage.getItem('cf-editor-session-id'))
    expect(sessionId).toBeTruthy()

    const duplicate = await original.context().newPage()
    try {
      await duplicate.addInitScript(() => {
        class NoopBroadcastChannel {
          onmessage: ((event: MessageEvent) => void) | null = null
          postMessage() {}
          addEventListener() {}
          removeEventListener() {}
          close() {}
        }
        Object.defineProperty(window, 'BroadcastChannel', {
          configurable: true,
          writable: true,
          value: NoopBroadcastChannel,
        })
      })
      await duplicate.goto(sandbox.chapterUrl, { waitUntil: 'domcontentloaded' })
      await duplicate.evaluate(
        id => sessionStorage.setItem('cf-editor-session-id', id as string),
        sessionId as string,
      )
      await duplicate.reload({ waitUntil: 'domcontentloaded' })
      await waitForReadOnly(duplicate, 'Lease owner')

      await original.locator('[contenteditable=true]').fill('Текст без BroadcastChannel ACK')
      await expect(original.getByRole('status')).toContainText('Сохранено')
      const { rows: [saved] } = await sandbox.db.query(
        'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
      )
      expect(saved.content).toBe('<p>Текст без BroadcastChannel ACK</p>')
    } finally {
      await duplicate.close()
    }
  })

  test('H4/H5: reload освобождает lease и возвращает редактирование', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.reload()
    await waitForEditable(page)
    await page.locator('[contenteditable=true]').fill('Текст после reload')
    await expect(page.getByRole('status')).toContainText('Сохранено')
    const { rows: [saved] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
    )
    expect(saved.content).toBe('<p>Текст после reload</p>')
  })

  test('H5: фоновая вкладка восстанавливает истёкший lease и сохраняет черновик', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await expireLease(sandbox.db, sandbox.chapterId)
    await page.locator('[contenteditable=true]').fill('Фоновый черновик')
    await setVisibility(page, 'hidden')
    await expect(page.getByRole('status')).toContainText(/Режим только для чтения|только для чтения/)

    await setVisibility(page, 'visible')
    await expect(page.getByRole('status')).toContainText('Сохранено', { timeout: 30_000 })
    await expect(page.locator('[contenteditable=true]')).toHaveText('Фоновый черновик')
    await expect(page.getByRole('alert').filter({ hasText: 'Глава уже редактируется' })).toHaveCount(0)

    const { rows: [saved] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
    )
    expect(saved.content).toBe('<p>Фоновый черновик</p>')
  })

  test('C1/H1: после возврата lease грязная очередь повторяет сохранение при той же ревизии', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await expireLease(sandbox.db, sandbox.chapterId)
    await page.locator('[contenteditable=true]').fill('Текст до потери lease')
    await expect(page.getByRole('status')).toContainText(/Режим только для чтения|только для чтения/)

    await expect(page.getByRole('status')).toContainText('Сохранено', { timeout: 35_000 })
    await expect(page.locator('[contenteditable=true]')).toBeVisible()

    const { rows: [saved] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
    )
    expect(saved.content).toBe('<p>Текст до потери lease</p>')
  })

  test('H1: новая ревизия перечитывает сервер и оставляет черновик доступным после перезагрузки', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await expireLease(sandbox.db, sandbox.chapterId)
    await page.locator('[contenteditable=true]').fill('Мой локальный текст')
    await expect(page.getByRole('status')).toContainText(/Режим только для чтения|только для чтения/)

    await sandbox.db.query(
      "UPDATE chapters SET title = 'Серверная глава', content = '<p>Серверный текст</p>' WHERE id = $1",
      [sandbox.chapterId],
    )
    await expect(page.locator('[contenteditable=true]')).toHaveText('Серверный текст', { timeout: 35_000 })
    await expect(page.getByRole('status')).toContainText('Локальные черновики')

    await page.reload()
    await waitForEditable(page)
    await expect(page.locator('[contenteditable=true]')).toHaveText('Серверный текст')
    await page.getByRole('button', { name: 'Локальные черновики' }).click()
    await expect(page.getByLabel('HTML черновика')).toHaveValue('<p>Мой локальный текст</p>')
  })

  test('H2/H3: комикс в read-only не меняется, а после возврата lease перечитывает серверные страницы', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.goto(sandbox.comicUrl, { waitUntil: 'domcontentloaded' })
    await waitForComicEditing(page)

    await expireLease(sandbox.db, sandbox.comicId)
    await page.getByRole('button', { name: 'Удалить страницу 1' }).click()
    await expect(page.getByAltText('Страница 1')).toHaveAttribute('src', /placeholder-user\.jpg/)

    await sandbox.db.query(
      'UPDATE chapters SET content = $2 WHERE id = $1',
      [sandbox.comicId, JSON.stringify(['/logo.png'])],
    )

    const second = await sandbox.newPageFor(sandbox.collaborator.email)
    await second.goto(sandbox.comicUrl, { waitUntil: 'domcontentloaded' })
    await waitForComicEditing(second)

    await setVisibility(page, 'visible')
    await expect(page.getByRole('alert').filter({ hasText: 'Глава уже редактируется' }))
      .toBeVisible({ timeout: 30_000 })

    const deleteButton = page.getByRole('button', { name: 'Удалить страницу 1' })
    await expect(deleteButton).toBeDisabled()
    await expect(page.locator('[draggable="true"]')).toHaveCount(0)
    await deleteButton.click({ force: true })
    await expect(page.getByAltText('Страница 1')).toBeVisible()

    await second.goto('/studio', { waitUntil: 'domcontentloaded' })
    await expect(page.getByAltText('Страница 1')).toHaveAttribute('src', /logo\.png/, { timeout: 30_000 })
    await expect(page.getByAltText('Страница 2')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Восстановить страницы' })).toBeEnabled()
  })

  test('H2: аудио после новой ревизии показывает серверный заголовок и не отправляет старый', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.goto(sandbox.audioUrl, { waitUntil: 'domcontentloaded' })
    await waitForAudioEditing(page)

    await expireLease(sandbox.db, sandbox.audioId)
    await page.getByLabel('Название').fill('Локальное название')
    await sandbox.db.query(
      "UPDATE chapters SET title = 'Серверное название' WHERE id = $1",
      [sandbox.audioId],
    )
    await setVisibility(page, 'visible')

    await expect(page.getByLabel('Название')).toHaveValue('Серверное название', { timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Восстановить поля' })).toBeEnabled()

    const { rows: [saved] } = await sandbox.db.query(
      'SELECT title FROM chapters WHERE id = $1', [sandbox.audioId],
    )
    expect(saved.title).toBe('Серверное название')
  })

  test('H1: переполнение хранилища не сбрасывает текст и предлагает копирование', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __originalSetItem: Storage['setItem'] }).__originalSetItem = original
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        if (String(key).startsWith('cf-chapter-draft-archive:') || String(key).startsWith('cf-media-draft:')) {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError')
        }
        return original.call(this, key, value)
      }
    })

    await expireLease(sandbox.db, sandbox.chapterId)
    await page.locator('[contenteditable=true]').fill('Текст при переполнении')
    await expect(page.getByRole('status')).toContainText(/Режим только для чтения|только для чтения/)
    await sandbox.db.query(
      "UPDATE chapters SET content = '<p>Серверный текст</p>' WHERE id = $1",
      [sandbox.chapterId],
    )
    await setVisibility(page, 'visible')

    const blocked = page.getByRole('alert').filter({ hasText: 'Хранилище браузера переполнено' })
    await expect(blocked).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.ProseMirror')).toHaveText('Текст при переполнении')
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
    await expect(page.getByRole('status')).not.toContainText('Сохранено')
    await expect(page.getByLabel('Текст несохранённого черновика')).toHaveValue('<p>Текст при переполнении</p>')

    await page.getByRole('button', { name: 'Скопировать текст' }).click()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Текст при переполнении')

    await page.evaluate(() => {
      Storage.prototype.setItem = (window as unknown as { __originalSetItem: Storage['setItem'] }).__originalSetItem
    })
    await page.getByRole('button', { name: 'Повторить сохранение черновика' }).click()
    await expect(page.locator('[contenteditable=true]')).toHaveText('Серверный текст', { timeout: 10_000 })
    await page.getByRole('button', { name: 'Локальные черновики' }).click()
    await expect(page.getByLabel('HTML черновика')).toHaveValue('<p>Текст при переполнении</p>')
  })

  test('занятый слот устаревшего черновика блокирует новые правки до архивации', async ({ sandbox }) => {
    const page = sandbox.owner.page
    const key = `cf-chapter-draft:${sandbox.owner.id}:${sandbox.chapterId}`
    await page.evaluate(({ key, original }) => {
      sessionStorage.setItem(key, JSON.stringify({
        version: 1,
        revision: 0,
        base: JSON.stringify({ title: 'Глава', content: original }),
        value: { title: 'Глава', content: '<p>Старый черновик</p>' },
      }))
    }, { key, original })
    await sandbox.db.query("UPDATE chapters SET title = 'Новая ревизия' WHERE id = $1", [sandbox.chapterId])
    await page.addInitScript(() => {
      const write = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('cf-chapter-draft-archive:') && !sessionStorage.getItem('allow-archive')) {
          throw new DOMException('full', 'QuotaExceededError')
        }
        return write.call(this, key, value)
      }
    })
    await page.reload()
    await expect(page.getByLabel('Старый локальный черновик')).toHaveValue('<p>Старый черновик</p>')
    await expect(page.locator('[contenteditable=true]')).toHaveCount(0)

    await page.evaluate(() => sessionStorage.setItem('allow-archive', '1'))
    await page.getByRole('button', { name: 'Повторить архивацию' }).click()
    await waitForEditable(page)
    await page.getByRole('button', { name: 'Локальные черновики' }).click()
    await expect(page.getByLabel('HTML черновика')).toHaveValue('<p>Старый черновик</p>')
  })

  test('H2: аудио сохраняет локальный черновик между перезагрузками', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.goto(sandbox.audioUrl, { waitUntil: 'domcontentloaded' })
    await waitForAudioEditing(page)

    await page.getByLabel('Название').fill('Локальное название')
    await expect(page.getByRole('status')).toContainText('Есть несохранённые правки')

    await page.reload()
    await waitForAudioEditing(page)
    await expect(page.getByText('Найден локальный черновик аудио')).toBeVisible()
    await page.getByRole('button', { name: 'Восстановить поля' }).click()
    await expect(page.getByLabel('Название')).toHaveValue('Локальное название')
    await expect(page.getByRole('status')).toContainText('Есть несохранённые правки')

    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByRole('status')).toContainText('Сохранено')
    const { rows: [saved] } = await sandbox.db.query(
      'SELECT title FROM chapters WHERE id = $1', [sandbox.audioId],
    )
    expect(saved.title).toBe('Локальное название')
  })

  test('аудиополя заблокированы до подтверждения сохранения', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.goto(sandbox.audioUrl, { waitUntil: 'domcontentloaded' })
    await waitForAudioEditing(page)
    const title = page.getByLabel('Название')
    await title.fill('Новый заголовок')

    let resume!: () => void
    const paused = new Promise<void>(resolve => { resume = resolve })
    await page.route(`**${sandbox.audioUrl}`, async route => {
      if (route.request().method() === 'POST') await paused
      await route.continue()
    })
    try {
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect(title).toBeDisabled()
    } finally {
      resume()
    }
    await expect(title).toBeEnabled()
    await expect(title).toHaveValue('Новый заголовок')
  })

  test('H2: комикс сохраняет черновик при offline и восстанавливает после reload', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.goto(sandbox.comicUrl, { waitUntil: 'domcontentloaded' })
    await waitForComicEditing(page)

    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Удалить страницу 1' }).click()
    await expect(page.getByAltText('Страница 1')).toHaveAttribute('src', /placeholder-user\.jpg/)
    await page.context().setOffline(false)

    await page.reload()
    await waitForComicEditing(page)
    await expect(page.getByText('Найден локальный черновик комикса')).toBeVisible()
    await expect(page.getByAltText('Страница 2')).toBeVisible()
    await expect(page.getByText('Сохранено')).toHaveCount(0)

    await page.getByRole('button', { name: 'Восстановить страницы' }).click()
    await expect(page.getByAltText('Страница 2')).toHaveCount(0)
    await expect.poll(async () => {
      const { rows: [row] } = await sandbox.db.query(
        'SELECT content FROM chapters WHERE id = $1', [sandbox.comicId],
      )
      return row.content
    }).toBe(JSON.stringify(['/placeholder-user.jpg']))
  })

  test('H2: конфликт ревизий комикса не перезаписывается автоматически', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.goto(sandbox.comicUrl, { waitUntil: 'domcontentloaded' })
    await waitForComicEditing(page)

    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Удалить страницу 1' }).click()
    await page.context().setOffline(false)

    await sandbox.db.query(
      'UPDATE chapters SET content = $2 WHERE id = $1',
      [sandbox.comicId, JSON.stringify(['/logo.png'])],
    )
    await page.reload()
    await waitForComicEditing(page)

    await expect(page.getByText('Глава изменилась: восстановление заменит текущие страницы.')).toBeVisible()
    await expect(page.getByAltText('Страница 1')).toHaveAttribute('src', /logo\.png/)
    const { rows: [row] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.comicId],
    )
    expect(row.content).toBe(JSON.stringify(['/logo.png']))
  })

  test('H2: загруженный, но непривязанный Blob показывается как черновик', async ({ sandbox }) => {
    const key = `cf-media-draft:audio:${sandbox.owner.id}:${sandbox.audioId}`
    await sandbox.owner.page.evaluate(({ key, chapterId, userId }) => {
      localStorage.setItem(key, JSON.stringify({
        version: 1,
        kind: 'audio',
        chapterId,
        userId,
        baseRevision: 0,
        savedAt: Date.now(),
        title: 'Черновик с файлом',
        content: JSON.stringify({
          duration_seconds: 10,
          audio_metadata: { artist: 'Автор' },
          pending_audio: {
            url: 'https://example.test/audio.mp3',
            pathname: `audio/chapters/${chapterId}/audio.mp3`,
            contentType: 'audio/mpeg',
            size: 1024,
          },
        }),
      }))
    }, { key, chapterId: sandbox.audioId, userId: sandbox.owner.id })

    await sandbox.owner.page.goto(sandbox.audioUrl, { waitUntil: 'domcontentloaded' })
    await waitForAudioEditing(sandbox.owner.page)
    await expect(sandbox.owner.page.getByText('Найден локальный черновик аудио')).toBeVisible()
    await sandbox.owner.page.getByRole('button', { name: 'Восстановить поля' }).click()
    await expect(sandbox.owner.page.getByText('Аудиофайл загружен, но не привязан к главе')).toBeVisible()
    await expect(sandbox.owner.page.getByRole('button', { name: 'Привязать загруженный файл' })).toBeVisible()
  })

  test('отзыв прав переводит редактор в read-only и не подтверждает сохранение', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await sandbox.db.query(
      'DELETE FROM release_collaborators WHERE release_id = $1 AND user_id = $2',
      [sandbox.releaseId, sandbox.owner.id],
    )

    await page.locator('[contenteditable=true]').fill('Текст после отзыва прав')
    await expect(page.getByRole('status')).toContainText('Доступ к главе отозван', { timeout: 20_000 })
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
    await expect(page.getByRole('status')).not.toContainText('Сохранено')

    const { rows: [saved] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
    )
    expect(saved.content).toBe(original)
    await waitForLeaseReleased(sandbox.db, sandbox.chapterId)
  })

  test('heartbeat распознаёт отзыв прав без новой попытки сохранения', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await sandbox.db.query(
      'DELETE FROM release_collaborators WHERE release_id = $1 AND user_id = $2',
      [sandbox.releaseId, sandbox.owner.id],
    )

    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.getByRole('alert').filter({ hasText: 'Доступ к главе отозван' }))
      .toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
    await waitForLeaseReleased(sandbox.db, sandbox.chapterId)
  })

  test('после отзыва прав повторный захват не уводит с незаписанным текстом', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.evaluate(() => {
      const write = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('cf-chapter-draft')) throw new DOMException('full', 'QuotaExceededError')
        return write.call(this, key, value)
      }
    })
    await expireLease(sandbox.db, sandbox.chapterId)
    await page.locator('[contenteditable=true]').fill('Правка только в памяти')
    await expect(page.getByRole('status')).toContainText('только для чтения')
    const second = await sandbox.newPageFor(sandbox.collaborator.email)
    await second.goto(sandbox.chapterUrl)
    await waitForEditable(second)
    await setVisibility(page, 'visible')
    await waitForReadOnly(page, 'Lease second')
    await sandbox.db.query(
      'DELETE FROM release_collaborators WHERE release_id = $1 AND user_id = $2',
      [sandbox.releaseId, sandbox.owner.id],
    )

    await page.getByRole('button', { name: 'Попробовать снова' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Доступ к главе отозван' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${sandbox.chapterUrl}$`))
    await expect(page.locator('.ProseMirror')).toHaveText('Правка только в памяти')
    await expect(page.locator('[contenteditable=true]')).toHaveCount(0)
  })

  test('offline не показывает «Сохранено» и повторяет запись после reconnect', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await page.context().setOffline(true)
    await page.locator('[contenteditable=true]').fill('Офлайн-правка')
    await expect(page.getByRole('status')).toContainText(/Ошибка|Не удалось/, { timeout: 20_000 })
    await expect(page.getByRole('status')).not.toContainText('Сохранено')

    await page.context().setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.getByRole('status')).toContainText('Сохранено', { timeout: 20_000 })
    const { rows: [saved] } = await sandbox.db.query(
      'SELECT content FROM chapters WHERE id = $1', [sandbox.chapterId],
    )
    expect(saved.content).toBe('<p>Офлайн-правка</p>')
  })

  test('read-only навигация архивирует черновик и не теряет текст', async ({ sandbox }) => {
    const page = sandbox.owner.page
    await expireLease(sandbox.db, sandbox.chapterId)
    await page.locator('[contenteditable=true]').fill('Черновик для навигации')
    await expect(page.getByRole('status')).toContainText(/Режим только для чтения|только для чтения/)

    const second = await sandbox.newPageFor(sandbox.collaborator.email)
    await second.goto(sandbox.chapterUrl, { waitUntil: 'domcontentloaded' })
    await waitForEditable(second)
    await setVisibility(page, 'visible')
    await expect(page.getByRole('alert').filter({ hasText: 'Глава уже редактируется' }))
      .toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)

    await page.locator(`header a[href="/studio/editions/${sandbox.editionId}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/studio/editions/${sandbox.editionId}$`), { timeout: 20_000 })

    await page.goto(sandbox.chapterUrl, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert').filter({ hasText: 'Глава уже редактируется' })).toBeVisible()
    await page.getByRole('button', { name: 'Локальные черновики' }).click()
    await expect(page.getByLabel('HTML черновика')).toHaveValue('<p>Черновик для навигации</p>')
  })

  test('JSON комикса сохраняет амперсанды в URL после reload', async ({ sandbox }) => {
    const pages = ['/placeholder.jpg?x=1&y=2']
    await sandbox.db.query(
      'UPDATE chapters SET content = $2 WHERE id = $1',
      [sandbox.comicId, JSON.stringify(pages)],
    )

    const page = sandbox.owner.page
    await page.goto(sandbox.comicUrl, { waitUntil: 'domcontentloaded' })
    await waitForComicEditing(page)
    await expect(page.getByAltText('Страница 1')).toHaveAttribute('src', /placeholder\.jpg\?x=1&y=2/)

    page.once('dialog', dialog => dialog.accept('/second.png?a=1&b=2'))
    await page.getByRole('button', { name: '+ URL' }).click()
    await expect.poll(async () => {
      const { rows: [row] } = await sandbox.db.query(
        'SELECT content FROM chapters WHERE id = $1', [sandbox.comicId],
      )
      return row.content
    }).toBe(JSON.stringify(['/placeholder.jpg?x=1&y=2', '/second.png?a=1&b=2']))

    await page.reload()
    await waitForComicEditing(page)
    await expect(page.getByAltText('Страница 2')).toHaveAttribute('src', /second\.png\?a=1&b=2/)
  })
})
