import { type Page, expect } from '@playwright/test'

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
