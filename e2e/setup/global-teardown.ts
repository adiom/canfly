import { Client } from 'pg'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnvLocal, pgConfig } from './pg'

const TEST_ADMIN_LOGIN = 'studio-test-admin@canfly.test'
const CREDENTIALS_FILE = join(process.cwd(), 'e2e', '.test-credentials.json')

export default async function globalTeardown() {
  loadEnvLocal()
  const url = process.env.DATABASE_URL
  if (existsSync(CREDENTIALS_FILE)) unlinkSync(CREDENTIALS_FILE)

  if (!url) return

  const client = new Client(pgConfig(url))

  try {
    await client.connect()
    await client.query('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE login = $1)', [
      TEST_ADMIN_LOGIN,
    ])
    await client.query('DELETE FROM users WHERE login = $1', [TEST_ADMIN_LOGIN])
    console.log(`[e2e teardown] ✓ Removed test admin: ${TEST_ADMIN_LOGIN}`)
  } catch (error) {
    console.error('[e2e teardown] ✗ Failed to remove test admin:', error)
  } finally {
    await client.end()
  }
}
