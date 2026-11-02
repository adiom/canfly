import { randomBytes, randomInt } from 'node:crypto'
import { Client } from 'pg'
import { type Page, expect } from '@playwright/test'
import { loadEnvLocal, pgConfig } from './pg'

/**
 * Log in via the browser-facing magic link flow.
 * In dev mode the token is displayed on screen after form submission.
 */
export async function loginViaMagicLink(page: Page, email: string) {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')

  // Step 1: enter email and submit
  const emailInput = page.locator('input[type="email"]')
  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await emailInput.fill(email)

  const submitButton = page.getByRole('button', { name: /получить ссылку/i })
  await submitButton.click()

  // Step 2: wait for the dev-mode code display and "Ввести код" button
  const codeElement = page.getByTestId('magic-code')
  await expect(codeElement).toBeVisible({ timeout: 15_000 })
  const code = await codeElement.textContent()
  expect(code).not.toBeNull()

  const enterCodeButton = page.getByRole('button', { name: /ввести код/i })
  await enterCodeButton.click()

  // Step 3: enter the code and submit
  const codeInput = page.locator('input[placeholder="12345678"]')
  await expect(codeInput).toBeVisible({ timeout: 5_000 })
  await codeInput.fill(code!.trim())

  const loginButton = page.getByRole('button', { name: /войти по коду/i })
  await loginButton.click()

  // Step 4: wait for successful authentication (redirect to /profile)
  await page.waitForURL('/profile', { timeout: 15_000 })
}

/**
 * Вход по magic-link токену, подложенному напрямую в БД, без почты —
 * общая версия "loginTestAdminByMagicLink" из studio.spec.ts (дублируется,
 * пока не мигрирован весь suite; UI-флоу с /api/magic-link ограничен
 * лимитами отправки писем).
 */
export async function loginViaMagicToken(page: Page, email: string) {
  // Прогрев cookie: в свежем контексте параллельные /api/auth/session и
  // /api/auth/csrf перезаписывают cookie друг друга — callback падает с
  // MissingCSRF. После /login cookie уже валиден.
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})

  loadEnvLocal()
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL не настроен — флаг-тест не выполним')

  const linkToken = randomBytes(32).toString('hex')
  const client = new Client(pgConfig(url))
  await client.connect()
  try {
    await client.query(
      `INSERT INTO magic_tokens (token, link_token, email, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
      [String(randomInt(10_000_000, 100_000_000)), linkToken, email],
    )
  } finally {
    await client.end()
  }

  await page.goto(`/hi/${linkToken}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('/profile', { timeout: 20_000 })
}
