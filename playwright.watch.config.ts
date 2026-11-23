import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

// Local visual E2E: run against the disposable CANFLY_E2E_DATABASE_URL only.
// Do not point this config at production or canfly_local.
export default defineConfig(baseConfig, {
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    headless: false,
    launchOptions: { slowMo: 450 },
  },
})
