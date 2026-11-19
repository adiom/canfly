import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ClientConfig } from 'pg'
import { requireE2eDatabaseUrl } from './environment'

export function pgConfig(url: string): ClientConfig {
  const confirmedUrl = requireE2eDatabaseUrl()
  if (url !== confirmedUrl) {
    throw new Error('PostgreSQL connection does not match the configured Playwright database')
  }
  return { connectionString: confirmedUrl, ssl: false }
}

export function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (key === 'CANFLY_E2E_DATABASE_URL' || key === 'DATABASE_URL' || key.startsWith('POSTGRES_') || key.startsWith('PG')) continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
