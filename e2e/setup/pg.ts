import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ClientConfig } from 'pg'

/**
 * Настройки подключения к БД для e2e. Локальный Postgres (Postgres.app) не
 * говорит по SSL, Neon — только по нему. Включаем ssl лишь для не-localhost.
 */
export function pgConfig(url: string): ClientConfig {
  const isLocal = /localhost|127\.0\.0\.1|::1/.test(url)
  return {
    connectionString: url,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  }
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
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
