import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.v2.config'

/** Public feed tests do not create users or mutate the connected database. */
export default defineConfig({
  ...baseConfig,
  testMatch: '**/v2-feed.spec.ts',
  workers: 1,
  use: {
    ...baseConfig.use,
    video: 'off',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
  },
})
