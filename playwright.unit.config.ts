import { defineConfig } from '@playwright/test'

/**
 * Чистые unit-тесты: без globalSetup, webServer и БД.
 * Запуск: pnpm test:unit
 */
export default defineConfig({
  testDir: './tests/unit',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  timeout: 15_000,
  expect: { timeout: 5_000 },
})
