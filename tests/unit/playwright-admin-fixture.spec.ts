import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock } from 'node:test'
import { expect, test } from '@playwright/test'
import { Client } from 'pg'
import globalSetup from '../../e2e/setup/global-setup'
import globalTeardown from '../../e2e/setup/global-teardown'
import { ADMIN_CREDENTIALS_ENV, loadTestCredentials } from '../../e2e/setup/credentials'

const firstUserId = '00000000-0000-4000-8000-000000000001'
const secondUserId = '00000000-0000-4000-8000-000000000002'
const controlId = '00000000-0000-4000-8000-000000000003'
const testDatabaseUrl = 'postgresql://unused@127.0.0.1:55432/canfly_e2e_fixture'

let environment: NodeJS.ProcessEnv
let directory: string
let users: Map<string, { email: unknown; login: unknown }>
let tokens: Set<unknown>
let insertError: Error | undefined
let deleteError: Error | undefined

test.beforeEach(() => {
  environment = { ...process.env }
  directory = fs.mkdtempSync(join(tmpdir(), 'canfly-fixture-test-'))
  process.env.TMPDIR = directory
  process.env.CANFLY_E2E_DATABASE_URL = testDatabaseUrl
  process.env.DATABASE_URL = testDatabaseUrl
  users = new Map([[controlId, { login: 'control', email: 'control@canfly.test' }]])
  tokens = new Set(['control@canfly.test'])
  insertError = undefined
  deleteError = undefined

  mock.method(Client.prototype, 'connect', async () => {})
  mock.method(Client.prototype, 'end', async () => {})
  mock.method(Client.prototype, 'query', async (sql: string, values: unknown[]) => {
    if (sql.includes('INSERT INTO users')) {
      if (insertError) throw insertError
      expect(sql).not.toContain('ON CONFLICT')
      expect(sql).toContain("TRUE, 'author'")
      const id = users.has(firstUserId) ? secondUserId : firstUserId
      const [login, email] = values
      users.set(id, { login, email })
      tokens.add(email)
      return { rows: [{ id }] }
    }
    if (sql.includes('DELETE FROM users')) {
      if (deleteError) throw deleteError
      expect(sql).toContain('WHERE id = $1 AND login = $2 AND email = $3')
      expect(sql).toContain('DELETE FROM magic_tokens')
      const [id, login, email] = values
      const user = users.get(String(id))
      if (!user) return { rows: [{ identity_mismatch: false }] }
      const matches = user.login === login && user.email === email
      if (matches) {
        users.delete(String(id))
        tokens.delete(email)
      }
      return { rows: [{ identity_mismatch: !matches }] }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  })
})

test('setup refuses an unconfirmed database before opening a connection', async () => {
  const connect = mock.method(Client.prototype, 'connect', async () => {})
  delete process.env.CANFLY_E2E_DATABASE_URL
  await expect(globalSetup()).rejects.toThrow('Set CANFLY_E2E_DATABASE_URL')
  expect(connect.mock.callCount()).toBe(0)
  expect([...users.keys()]).toEqual([controlId])
})

test('teardown refuses a different database and retains the cleanup file', async () => {
  await globalSetup()
  const credentials = loadTestCredentials()
  const connect = mock.method(Client.prototype, 'connect', async () => {})
  process.env.DATABASE_URL = 'postgresql://unused@ep-production.example.invalid/neondb'

  await expect(globalTeardown()).rejects.toThrow('does not match the configured Playwright database')
  expect(connect.mock.callCount()).toBe(0)
  expect(loadTestCredentials()).toEqual(credentials)
  expect(users.has(firstUserId)).toBe(true)
})

test.afterEach(() => {
  mock.restoreAll()
  for (const key of Object.keys(process.env)) {
    if (!(key in environment)) delete process.env[key]
  }
  Object.assign(process.env, environment)
  fs.rmSync(directory, { recursive: true, force: true })
})

test('two runs keep different credentials and clean only their own fixture', async () => {
  await globalSetup()
  const firstPath = process.env[ADMIN_CREDENTIALS_ENV]!
  const first = loadTestCredentials()!
  await globalSetup()
  const secondPath = process.env[ADMIN_CREDENTIALS_ENV]!
  const second = loadTestCredentials()!

  expect(firstPath).not.toBe(secondPath)
  expect(first.email).not.toBe(second.email)
  expect(users.get(first.userId)?.login).not.toBe(users.get(second.userId)?.login)

  await globalTeardown()
  await globalTeardown()
  expect(fs.existsSync(secondPath)).toBe(false)
  expect(fs.existsSync(firstPath)).toBe(true)
  expect(loadTestCredentials()).toBeNull()
  expect([...users.keys()]).toEqual([controlId, first.userId])
  expect(tokens.has(second.email)).toBe(false)
  expect(tokens.has(first.email)).toBe(true)

  process.env[ADMIN_CREDENTIALS_ENV] = firstPath
  await globalTeardown()
  expect([...users.keys()]).toEqual([controlId])
  expect([...tokens]).toEqual(['control@canfly.test'])
})

test('an insert conflict preserves the pre-existing user and publishes no credentials', async () => {
  insertError = new Error('duplicate key')
  await expect(globalSetup()).rejects.toThrow('duplicate key')
  expect(loadTestCredentials()).toBeNull()
  expect(fs.readdirSync(directory)).toEqual([])
  expect([...users.keys()]).toEqual([controlId])
})

test('a credentials publication failure compensates the insert and removes temporary files', async () => {
  const writeFile = fs.writeFileSync
  mock.method(fs, 'writeFileSync', (...args: Parameters<typeof writeFile>) => {
    const [path] = args
    if (typeof path === 'string' && path.endsWith('/admin.json')) {
      writeFile(path, '{')
      throw new Error('credentials write failed')
    }
    writeFile(...args)
  })

  await expect(globalSetup()).rejects.toThrow('credentials write failed')
  expect(loadTestCredentials()).toBeNull()
  expect(fs.readdirSync(directory)).toEqual([])
  expect([...users.keys()]).toEqual([controlId])
  expect([...tokens]).toEqual(['control@canfly.test'])
})

test('SQL cleanup failure retains credentials and lets teardown retry', async () => {
  await globalSetup()
  const credentials = loadTestCredentials()
  const path = process.env[ADMIN_CREDENTIALS_ENV]!
  deleteError = new Error('cleanup unavailable')
  await expect(globalTeardown()).rejects.toMatchObject({
    message: expect.stringContaining(path),
    cause: deleteError,
  })
  expect(loadTestCredentials()).toEqual(credentials)

  deleteError = undefined
  await globalTeardown()
  expect(loadTestCredentials()).toBeNull()
  expect([...users.keys()]).toEqual([controlId])
})

test('teardown can retry after SQL succeeded and file removal failed', async () => {
  await globalSetup()
  const credentials = loadTestCredentials()
  const path = process.env[ADMIN_CREDENTIALS_ENV]
  const removeFile = fs.rmSync
  const failedRemoval = mock.method(fs, 'rmSync', (...args: Parameters<typeof removeFile>) => {
    if (args[0] === path) throw new Error('credentials removal failed')
    removeFile(...args)
  })

  await expect(globalTeardown()).rejects.toThrow('credentials removal failed')
  expect(loadTestCredentials()).toEqual(credentials)
  expect([...users.keys()]).toEqual([controlId])

  failedRemoval.mock.restore()
  await globalTeardown()
  await globalTeardown()
  expect(loadTestCredentials()).toBeNull()
  expect([...users.keys()]).toEqual([controlId])
  expect([...tokens]).toEqual(['control@canfly.test'])
})

test('teardown reports both SQL and connection-close failures', async () => {
  await globalSetup()
  const credentials = loadTestCredentials()
  const closeError = new Error('connection close failed')
  deleteError = new Error('cleanup unavailable')
  mock.method(Client.prototype, 'end', async () => { throw closeError })

  await expect(globalTeardown()).rejects.toMatchObject({
    cause: expect.objectContaining({ errors: [deleteError, closeError] }),
  })
  expect(loadTestCredentials()).toEqual(credentials)
})

test('teardown rejects a mismatched identity and keeps credentials', async () => {
  await globalSetup()
  const credentials = loadTestCredentials()!
  users.set(credentials.userId, { login: 'another_user', email: credentials.email })

  await expect(globalTeardown()).rejects.toMatchObject({
    cause: expect.objectContaining({ message: expect.stringContaining('does not match') }),
  })
  expect(loadTestCredentials()).toEqual(credentials)
  expect(users.get(credentials.userId)?.login).toBe('another_user')
})
