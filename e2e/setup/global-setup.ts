import { Client } from 'pg'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadEnvLocal, pgConfig } from './pg'

const TEST_ADMIN_EMAIL = 'studio-test-admin@canfly.test'
const TEST_ADMIN_LOGIN = 'studio_test_admin'
const TEST_ADMIN_DISPLAY = 'Studio Test Admin'
const TEST_ADMIN_HANDLE = 'studio_test_admin'
const CREDENTIALS_FILE = join(process.cwd(), 'e2e', '.test-credentials.json')

export default async function globalSetup() {
  loadEnvLocal()

  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn('[e2e setup] DATABASE_URL is not set — skipping admin test setup')
    return
  }

  const client = new Client(pgConfig(url))

  try {
    await client.connect()

    const userResult = await client.query<{ id: string }>(
      `
        INSERT INTO users (login, email, handle, display_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (login) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              email = EXCLUDED.email
        RETURNING id
      `,
      [TEST_ADMIN_LOGIN, TEST_ADMIN_EMAIL, TEST_ADMIN_HANDLE, TEST_ADMIN_DISPLAY],
    )
    const userId = userResult.rows[0]?.id
    if (!userId) throw new Error('Failed to upsert test admin user')

    await client.query(
      `
        UPDATE users
        SET is_admin = TRUE, public_role = 'author'
        WHERE id = $1
      `,
      [userId],
    )

    mkdirSync(dirname(CREDENTIALS_FILE), { recursive: true })
    writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(
        {
          email: TEST_ADMIN_EMAIL,
          userId,
        },
        null,
        2,
      ),
    )

    console.log(`[e2e setup] ✓ Test admin ready: ${TEST_ADMIN_LOGIN} <${TEST_ADMIN_EMAIL}>`)
  } catch (error) {
    console.error('[e2e setup] ✗ Failed to create test admin:', error)
    throw error
  } finally {
    await client.end()
  }
}
