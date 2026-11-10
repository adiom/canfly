import { defineConfig } from '@playwright/test'

import baseConfig from './playwright.config'

/** Публичные проверки `/v2`: без создания пользователей и любых мутаций БД. */
export default defineConfig({
  ...baseConfig,
  testMatch: '**/v2.spec.ts',
  globalSetup: undefined,
  globalTeardown: undefined,
  workers: 2,
})
