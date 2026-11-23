import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import { mock } from 'node:test'
import { join } from 'node:path'
import { e2eEnvironment, requireE2eDatabaseUrl } from '../../e2e/setup/environment'
import { loadEnvLocal } from '../../e2e/setup/pg'

const testDatabaseUrl = 'postgresql://fixture@127.0.0.1:55432/canfly_e2e_local'

test('Playwright requires an explicit isolated database rather than the application database', () => {
  expect(() => e2eEnvironment({ DATABASE_URL: testDatabaseUrl })).toThrow('Set CANFLY_E2E_DATABASE_URL')
})

for (const [scenario, url] of [
  ['remote Neon host', 'postgresql://fixture@ep-production.example.invalid:5432/canfly_e2e_local'],
  ['loopback substring outside the hostname', 'postgresql://127.0.0.1@remote.example.invalid:5432/canfly_e2e_local'],
  ['production database name on a forwarded port', 'postgresql://fixture@127.0.0.1:55432/neondb'],
  ['hostname override', testDatabaseUrl + '?host=ep-production.example.invalid'],
  ['missing port', 'postgresql://fixture@127.0.0.1/canfly_e2e_local'],
  ['non-PostgreSQL URL', 'https://fixture@127.0.0.1:55432/canfly_e2e_local'],
] as const) {
  test(`Playwright rejects a database URL with ${scenario}`, () => {
    expect(() => requireE2eDatabaseUrl({ CANFLY_E2E_DATABASE_URL: url })).toThrow('must name a canfly_e2e_*')
  })
}

test('a remote BASE_URL or mismatched local port cannot redirect browser tests', () => {
  for (const BASE_URL of ['https://canfly.example.invalid', 'http://127.0.0.1:3000']) {
    expect(() => e2eEnvironment({ CANFLY_E2E_DATABASE_URL: testDatabaseUrl, BASE_URL }))
      .toThrow('must match its own local web server')
  }
})

test('Playwright rejects an invalid web server port', () => {
  expect(() => e2eEnvironment({ CANFLY_E2E_DATABASE_URL: testDatabaseUrl, PORT: '65536' }))
    .toThrow('Playwright PORT must be an integer')
})

test('local env files cannot authorize or replace the database used by Playwright', () => {
  const path = join(process.cwd(), '.env.local')
  const variables = {
    CANFLY_E2E_DATABASE_URL: testDatabaseUrl,
    DATABASE_URL: 'postgresql://fixture@production.example.invalid/neondb',
    POSTGRES_URL: 'postgresql://fixture@production.example.invalid/neondb',
    PGHOST: 'production.example.invalid',
    CANFLY_E2E_TEST_MARKER: 'loaded',
  }
  const previous = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]]))
  const exists = fs.existsSync
  const readFile = fs.readFileSync
  const existsMock = mock.method(fs, 'existsSync', (file: fs.PathLike) => file === path || exists(file))
  const readMock = mock.method(fs, 'readFileSync', (...args: Parameters<typeof readFile>) => {
    if (args[0] === path) return Object.entries(variables).map(([key, value]) => `${key}=${value}`).join('\n')
    return readFile(...args)
  })
  try {
    for (const key of Object.keys(variables)) delete process.env[key]
    loadEnvLocal()
    expect(process.env.CANFLY_E2E_TEST_MARKER).toBe('loaded')
    expect(process.env.CANFLY_E2E_DATABASE_URL).toBeUndefined()
    expect(process.env.DATABASE_URL).toBeUndefined()
    expect(process.env.POSTGRES_URL).toBeUndefined()
    expect(process.env.PGHOST).toBeUndefined()
  } finally {
    existsMock.mock.restore()
    readMock.mock.restore()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('Playwright injects only the confirmed database and waits for its own server on the exact port', () => {
  const { baseURL, databaseUrl, webServer } = e2eEnvironment({
    CANFLY_E2E_DATABASE_URL: testDatabaseUrl,
    DATABASE_URL: 'postgresql://fixture@production.example.invalid/neondb',
    CI: '1',
    PORT: '3210',
  })
  expect(databaseUrl).toBe(testDatabaseUrl)
  expect(webServer.env.DATABASE_URL).toBe(testDatabaseUrl)
  expect(webServer.env.NEXT_PUBLIC_BASE_URL).toBe(baseURL)
  expect(webServer.env.AUTH_URL).toBe(baseURL)
  expect(webServer.env.NEXTAUTH_URL).toBe(baseURL)
  expect(baseURL).toBe('http://127.0.0.1:3210')
  expect(webServer.command).toBe('pnpm dev --hostname 127.0.0.1 --port 3210')
  expect(webServer.reuseExistingServer).toBe(false)
  expect(webServer).not.toHaveProperty('url')
  expect(webServer).not.toHaveProperty('port')
  expect(webServer.wait.stdout.test('✓ Ready in 100ms')).toBe(false)
  expect(webServer.wait.stdout.test('  - Local: http://127.0.0.1:3211\n✓ Ready in 100ms')).toBe(false)
  expect(webServer.wait.stdout.test('  - Local: http://127.0.0.1:3210\n✓ Ready in 100ms')).toBe(true)
})
