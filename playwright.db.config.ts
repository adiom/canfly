import { defineConfig } from '@playwright/test'
import { requireE2eDatabaseUrl } from './e2e/setup/environment'

process.env.DATABASE_URL = requireE2eDatabaseUrl()
process.env.PGOPTIONS = '-c search_path=public'

export default defineConfig({
  testDir: './tests/db',
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
})
