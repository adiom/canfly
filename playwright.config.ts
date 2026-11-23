import { defineConfig, devices } from '@playwright/test'
import { e2eEnvironment } from './e2e/setup/environment'

// Config loads before Playwright starts its web server, fixtures or workers.
const { baseURL, databaseUrl, webServer } = e2eEnvironment(process.env)
process.env.DATABASE_URL = databaseUrl

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/setup/**', '**/_helpers/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  globalSetup: ['./e2e/setup/db-preflight.ts', './e2e/setup/global-setup.ts'],
  globalTeardown: './e2e/setup/global-teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer,
})
