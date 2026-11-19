import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { ADMIN_CREDENTIALS_ENV, adminLogin } from './credentials'
import { deleteTestAdmin } from './global-teardown'
import { loadEnvLocal, pgConfig } from './pg'

export default async function globalSetup() {
  loadEnvLocal()
  delete process.env[ADMIN_CREDENTIALS_ENV]

  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn('[e2e setup] DATABASE_URL is not set — skipping admin test setup')
    return
  }

  const email = `studio-test-admin-${randomBytes(8).toString('hex')}@canfly.test`
  const login = adminLogin(email)
  const client = new Client(pgConfig(url))

  try {
    await client.connect()
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (login, email, handle, display_name, is_admin, public_role)
       VALUES ($1, $2, $1, 'Studio Test Admin', TRUE, 'author')
       RETURNING id`,
      [login, email],
    )
    const userId = rows[0]?.id
    if (!userId) throw new Error('Failed to create Playwright admin')

    let directory: string | undefined
    let path: string | undefined
    try {
      directory = mkdtempSync(join(tmpdir(), 'canfly-playwright-'))
      path = join(directory, 'admin.json')
      writeFileSync(path, JSON.stringify({ email, userId }), { flag: 'wx', mode: 0o600 })
    } catch (error) {
      try {
        await deleteTestAdmin(client, { email, userId })
        if (path) rmSync(path, { force: true })
        if (directory) rmdirSync(directory)
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Failed to publish and clean up Playwright admin ${userId} (${email})`,
        )
      }
      throw error
    }

    process.env[ADMIN_CREDENTIALS_ENV] = path
  } finally {
    await client.end()
  }
}
