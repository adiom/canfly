#!/usr/bin/env node
/**
 * Локальный вход в Studio для agent-browser на одноразовой PostgreSQL.
 *
 * Скрипт намеренно отказывается работать с любой базой, кроме
 * canfly_e2e_* на 127.0.0.1: это единственная безопасная цель для
 * браузерных проверок. Production-база и рабочая БД не затрагиваются.
 */
import { randomBytes, randomInt } from 'node:crypto'
import { Client } from 'pg'
import { requireE2eDatabaseUrl } from '../e2e/setup/environment.ts'

const baseUrl = process.env.CANFLY_BROWSER_BASE_URL ?? 'http://127.0.0.1:3101'
const email = process.env.CANFLY_BROWSER_EMAIL ?? 'studio-browser@canfly.test'
const login = process.env.CANFLY_BROWSER_LOGIN ?? 'studio_browser'

let databaseUrl
try {
  databaseUrl = requireE2eDatabaseUrl()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error('Задайте CANFLY_E2E_DATABASE_URL на canfly_e2e_* по адресу 127.0.0.1.')
  process.exit(1)
}

const client = new Client({ connectionString: databaseUrl })
try {
  await client.connect()
  const { rows: [user] } = await client.query(
    `INSERT INTO users (login, email, handle, display_name, is_admin, public_role)
     VALUES ($1, $2, $1, 'Studio Browser', TRUE, 'author')
     ON CONFLICT (email) DO UPDATE
       SET is_admin = TRUE, public_role = 'author', is_deleted = FALSE, deleted_at = NULL
     RETURNING id`,
    [login, email],
  )
  if (!user) throw new Error('Не удалось создать локального пользователя')

  const linkToken = randomBytes(32).toString('hex')
  await client.query(
    `INSERT INTO magic_tokens (token, link_token, email, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [String(randomInt(10_000_000, 100_000_000)), linkToken, email],
  )

  const url = `${baseUrl.replace(/\/$/, '')}/hi/${linkToken}`
  console.log(`export STUDIO_LOGIN_URL=${url}`)
  console.log('SESSION="$(agent-browser session id --scope worktree --prefix canfly-studio)"')
  console.log('agent-browser --session "$SESSION" --restore --args "--no-sandbox" --enable react-devtools open "$STUDIO_LOGIN_URL"')
  console.log('# после входа: agent-browser --session "$SESSION" open <dev-base-url>/studio')
  console.log('# закрыть:      agent-browser --session "$SESSION" --restore close')
} finally {
  await client.end()
}
