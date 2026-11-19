import { readFileSync } from 'node:fs'

export interface TestCredentials {
  email: string
  userId: string
}

export const ADMIN_CREDENTIALS_ENV = 'CANFLY_E2E_ADMIN_FILE'

export function adminLogin(email: string): string {
  const suffix = /^studio-test-admin-([0-9a-f]{16})@canfly\.test$/.exec(email)?.[1]
  if (!suffix) throw new Error('Invalid Playwright admin email')
  return `studio_test_${suffix}`
}

export function readTestCredentials(path: string): TestCredentials {
  const data: Partial<TestCredentials> | null = JSON.parse(readFileSync(path, 'utf-8'))
  if (typeof data?.email !== 'string' || typeof data.userId !== 'string' ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.userId)) {
    throw new Error('Invalid Playwright admin credentials')
  }
  adminLogin(data.email)
  return { email: data.email, userId: data.userId }
}

export function loadTestCredentials(): TestCredentials | null {
  const path = process.env[ADMIN_CREDENTIALS_ENV]
  if (!path) return null
  try {
    return readTestCredentials(path)
  } catch {
    return null
  }
}
