import { existsSync, rmSync, rmdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Client } from 'pg'
import { ADMIN_CREDENTIALS_ENV, adminLogin, readTestCredentials, type TestCredentials } from './credentials'
import { pgConfig } from './pg'

export async function deleteTestAdmin(client: Client, { email, userId }: TestCredentials) {
  // user_roles and other user-owned rows with ON DELETE CASCADE follow the user.
  // Magic tokens are keyed by email and share the atomic cleanup statement.
  const { rows } = await client.query<{ identity_mismatch: boolean }>(
    `WITH deleted_admin AS (
       DELETE FROM users WHERE id = $1 AND login = $2 AND email = $3
       RETURNING email
     ), deleted_tokens AS (
       DELETE FROM magic_tokens WHERE email IN (SELECT email FROM deleted_admin)
     )
     SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)
        AND NOT EXISTS (SELECT 1 FROM deleted_admin) AS identity_mismatch`,
    [userId, adminLogin(email), email],
  )
  if (rows[0]?.identity_mismatch !== false) {
    throw new Error(`Playwright admin identity does not match fixture ${userId}`)
  }
}

export default async function globalTeardown() {
  const path = process.env[ADMIN_CREDENTIALS_ENV]
  if (!path) return
  if (!existsSync(path)) {
    throw new Error('Playwright admin credentials are missing during cleanup')
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required to clean up the Playwright admin')

  const credentials = readTestCredentials(path)
  const client = new Client(pgConfig(url))
  try {
    try {
      await client.connect()
      await deleteTestAdmin(client, credentials)
    } catch (error) {
      await client.end().catch(closeError => {
        throw new AggregateError([error, closeError], 'Playwright admin cleanup and connection close both failed')
      })
      throw error
    }
    await client.end()
  } catch (cause) {
    throw new Error(`Playwright admin cleanup failed. Retry with credentials at ${path}`, { cause })
  }

  rmSync(path)
  delete process.env[ADMIN_CREDENTIALS_ENV]
  rmdirSync(dirname(path))
}
