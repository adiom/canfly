import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { createDedicatedDatabaseClient } from '../lib/db.ts'
import { requireE2eDatabaseUrl } from '../e2e/setup/environment.ts'

const baselineDir = new URL('../postgres/baseline/', import.meta.url)
const versionedDir = new URL('../postgres/versioned/', import.meta.url)
const neonHost = 'ep-ancient-feather-bbgnicrs.c-15.us-east-1.aws.neon.tech'
const baselineChecksum = 'a96e1801f64f79e790311a1bd1e8d87ff27ccef96e30e07563d6cc44da95a969'
const lockKey = '4865638142842026000'
const journal = 'canfly_migrations.schema_migrations'

export class MigrationError extends Error {}

class DatabaseFailure extends MigrationError {
  constructor(operation, error) {
    const code = typeof error?.code === 'string' && /^[A-Z0-9_]{5,32}$/.test(error.code)
      ? ` (${error.code})`
      : ''
    super(`${operation} failed${code}`)
  }
}

export function migrationError(error) {
  // PostgreSQL messages, details and notices can contain data, SQL or credentials.
  return error instanceof MigrationError ? error.message : 'Migration command failed'
}

export function migrationTarget(env) {
  const value = env.CANFLY_MIGRATION_DATABASE_URL
  if (!value) throw new MigrationError('Set CANFLY_MIGRATION_DATABASE_URL explicitly')

  let url
  try {
    url = new URL(value)
  } catch {
    throw new MigrationError('Invalid CANFLY_MIGRATION_DATABASE_URL')
  }

  if (url.hostname === '127.0.0.1') {
    try {
      requireE2eDatabaseUrl({ CANFLY_E2E_DATABASE_URL: value })
    } catch {
      throw new MigrationError('Expected canfly_e2e_* on 127.0.0.1 with an explicit port and no URL options')
    }
  } else {
    const params = url.searchParams
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname !== neonHost ||
      (url.port && url.port !== '5432') || url.pathname !== '/canfly_tests' ||
      !url.username || !url.password || url.hash ||
      [...params.keys()].some(key => !['sslmode', 'channel_binding'].includes(key)) ||
      params.getAll('sslmode').length > 1 ||
      (params.has('sslmode') && !['require', 'verify-full'].includes(params.get('sslmode'))) ||
      params.getAll('channel_binding').length > 1 ||
      (params.has('channel_binding') && params.get('channel_binding') !== 'require')
    ) {
      throw new MigrationError('Expected the direct canfly_tests endpoint of Neon project muddy-heart-67237859')
    }
  }

  let user
  let password
  try {
    user = decodeURIComponent(url.username)
    password = decodeURIComponent(url.password)
  } catch {
    throw new MigrationError('Invalid credentials encoding in migration URL')
  }
  if (user.includes('\0') || password.includes('\0')) {
    throw new MigrationError('Invalid credentials encoding in migration URL')
  }
  const database = url.pathname.slice(1)
  const local = url.hostname === '127.0.0.1'
  return {
    label: `${url.hostname}${local ? `:${url.port}` : ''}/${database}`,
    database,
    config: {
      host: url.hostname,
      port: Number(url.port || 5432),
      database,
      user,
      // A callback avoids pg falling back to ambient credentials for local trust auth.
      password: password || (() => ''),
      ssl: local ? false : { rejectUnauthorized: true },
      enableChannelBinding: !local,
      application_name: 'canfly-migrate',
      client_encoding: 'UTF8',
      options: '-c search_path=pg_catalog',
    },
  }
}

export function migrationRequest(command, args, env) {
  if (!['status', 'verify', 'baseline', 'up'].includes(command)) {
    throw new MigrationError('Expected status, verify, baseline or up')
  }
  const target = migrationTarget(env)
  const writes = command === 'baseline' || command === 'up'
  const confirmation = `--confirm=${target.label}`
  if (writes ? args.length !== 1 || args[0] !== confirmation : args.length !== 0) {
    throw new MigrationError(writes ? `Pass ${confirmation} to authorize this target` : 'Unexpected arguments')
  }
  return target
}

export async function openMigrationTarget(target) {
  const client = createDedicatedDatabaseClient(target.config)
  // A disconnect between queries must not emit an unhandled event.
  client.on('error', () => {})
  try {
    await client.connect()
    const { rows: [actual] } = await client.query(`
      SELECT current_database() AS database,
        current_setting('server_version_num')::int / 10000 AS major,
        inet_server_addr() IS NOT NULL AS tcp
    `)
    if (actual.database !== target.database || actual.major !== 17 || !actual.tcp) {
      throw new MigrationError('Target database identity or PostgreSQL 17 check failed')
    }
    return client
  } catch (error) {
    await client.end()
    if (error instanceof MigrationError) throw error
    throw new DatabaseFailure('Connecting to the migration target', error)
  }
}

export async function readMigrationPlan(directory = versionedDir) {
  const baseline = await readFile(new URL('0000.sql', baselineDir))
  if (sha256(baseline) !== baselineChecksum) throw new MigrationError('The frozen 0000.sql baseline changed')
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.name.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.name < b.name ? -1 : a.name === b.name ? 0 : 1)
  const plan = [{ version: '0000', filename: '0000.sql', checksum: baselineChecksum }]
  for (const file of files) {
    const match = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/.exec(file.name)
    if (!file.isFile() || !match || Number(match[1]) !== plan.length) {
      throw new MigrationError(`Expected exactly one SQL file for version ${String(plan.length).padStart(4, '0')}`)
    }
    const bytes = await readFile(new URL(file.name, directory))
    const sql = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (!sql.trim()) throw new MigrationError(`Migration ${match[1]} is empty`)
    plan.push({ version: match[1], filename: file.name, checksum: sha256(bytes), sql })
  }
  return plan
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function readJournal(client, plan) {
  const { rows: [state] } = await client.query(`
    SELECT to_regnamespace('canfly_migrations') IS NOT NULL AS present,
      (SELECT relkind FROM pg_class WHERE oid = to_regclass('${journal}')) AS kind
  `)
  if (!state.present) return []
  if (state.kind !== 'r') throw new MigrationError('Migration journal is missing or invalid')
  const { rows } = await client.query(`
    SELECT version, filename, checksum, applied_at FROM ${journal} ORDER BY version
  `)
  if (!rows.length) throw new MigrationError('Migration journal exists without a baseline entry')

  for (const [index, recorded] of rows.entries()) {
    const expected = plan[index]
    if (!expected || expected.version !== recorded.version) {
      throw new MigrationError(`Journal history diverges at version ${String(index).padStart(4, '0')}`)
    }
    if (expected.filename !== recorded.filename || expected.checksum !== recorded.checksum) {
      throw new MigrationError(`Applied migration ${expected.version} has a different filename or checksum`)
    }
  }
  return rows
}

async function checkBaseline(client) {
  const [sql, manifest] = await Promise.all([
    readFile(new URL('catalog.sql', baselineDir), 'utf8'),
    readFile(new URL('production-manifest.json', baselineDir), 'utf8'),
  ])
  const [, catalog] = await client.query(sql)
  const actual = catalog.rows[0].jsonb_object_agg
  const expected = JSON.parse(manifest)
  const categories = new Set([...Object.keys(expected), ...Object.keys(actual)])
  const differences = [...categories].filter(category => {
    const rows = actual[category]?.slice()
    const reference = expected[category]
    if (!Array.isArray(rows) || !Array.isArray(reference) || rows.length !== reference.length) return true
    for (const entry of reference) {
      const index = rows.findIndex(row => isDeepStrictEqual(row, entry))
      if (index === -1) return true
      rows.splice(index, 1)
    }
    return false
  })
  if (differences.length) throw new MigrationError(`Baseline manifest differs in: ${differences.join(', ')}`)
  return categories.size
}

async function transaction(client, operation, callback, mode = '') {
  try {
    await client.query(`BEGIN ${mode}`)
    await client.query("SET LOCAL lock_timeout = '5s'")
    const result = await callback()
    const commit = await client.query('COMMIT')
    if (commit.command !== 'COMMIT') throw new MigrationError('Transaction did not commit')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error instanceof MigrationError) throw error
    throw new DatabaseFailure(operation, error)
  }
}

async function recordMigration(client, { version, filename, checksum }) {
  await client.query(`
    INSERT INTO ${journal} (version, filename, checksum) VALUES ($1, $2, $3)
  `, [version, filename, checksum])
}

function transactionalSql(sql) {
  // SPI executes the file inside a PL/pgSQL function and rejects transaction
  // control even if it appears after valid DDL. Use a delimiter absent from the file.
  let suffix = 0
  while (sql.includes(`$canfly_${suffix}$`) || sql.includes(`$sql_${suffix}$`)) suffix++
  const body = `$canfly_${suffix}$`
  const literal = `$sql_${suffix}$`
  return `DO ${body} BEGIN EXECUTE ${literal}${sql}${literal}; END; ${body}`
}

export async function runMigrations(client, command, directory) {
  const plan = await readMigrationPlan(directory)
  const { rows: [{ acquired }] } = await client.query(
    'SELECT pg_try_advisory_lock($1::bigint) AS acquired', [lockKey],
  ).catch(error => { throw new DatabaseFailure('Acquiring the migration lock', error) })
  if (!acquired) throw new MigrationError('Another migration operation holds the database lock')

  try {
    if (command === 'status' || command === 'verify') {
      return await transaction(client, 'Reading migration state', async () => {
        const applied = await readJournal(client, plan)
        if (command === 'status') {
          return plan.map(({ filename }, index) => applied[index]
            ? `${filename}: applied at ${applied[index].applied_at.toISOString()}`
            : `${filename}: ${index === 0 ? 'unregistered' : 'pending'}`)
        }
        const lines = [`Journal integrity verified: ${applied.length} applied, ${plan.length - applied.length} pending`]
        if (applied.length <= 1) lines.push(`Baseline manifest matches (${await checkBaseline(client)} categories)`)
        if (!applied.length) lines.push('Baseline is ready for registration')
        return lines
      }, 'ISOLATION LEVEL REPEATABLE READ READ ONLY')
    }

    if (command === 'baseline') {
      return await transaction(client, 'Registering baseline', async () => {
        const applied = await readJournal(client, plan)
        if (applied.length) return ['Baseline already registered']
        const categories = await checkBaseline(client)
        await client.query(`
          CREATE SCHEMA canfly_migrations;
          REVOKE ALL ON SCHEMA canfly_migrations FROM PUBLIC;
          CREATE TABLE ${journal} (
            version text PRIMARY KEY CHECK (version ~ '^[0-9]{4}$'),
            filename text NOT NULL,
            checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
            applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
          );
          REVOKE ALL ON TABLE ${journal} FROM PUBLIC
        `)
        await recordMigration(client, plan[0])
        return [`Registered baseline 0000 after verifying ${categories} catalog categories`]
      }, 'ISOLATION LEVEL REPEATABLE READ')
    }

    if (command !== 'up') throw new MigrationError('Unknown migration command')
    const applied = await readJournal(client, plan)
    if (!applied.length) throw new MigrationError('Register the baseline with db:migrate:baseline first')

    const pending = plan.slice(applied.length)
    for (const migration of pending) {
      await transaction(client, `Migration ${migration.version}`, async () => {
        await client.query('SET LOCAL search_path = public')
        await client.query(transactionalSql(migration.sql))
        await recordMigration(client, migration)
      })
    }
    return pending.length ? pending.map(({ filename }) => `Applied ${filename}`) : ['No pending migrations']
  } catch (error) {
    if (error instanceof MigrationError) throw error
    throw new DatabaseFailure('Checking migration state', error)
  } finally {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey]).catch(() => {})
  }
}
