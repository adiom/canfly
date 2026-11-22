import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { migrationError, migrationRequest, migrationTarget, openMigrationTarget, readMigrationPlan, runMigrations } from './db-migrations.mjs'

const host = 'ep-ancient-feather-bbgnicrs.c-15.us-east-1.aws.neon.tech'
const local = 'postgresql://owner@127.0.0.1:55432/canfly_e2e_migration_system'
const neon = `postgresql://owner:dummy@${host}/canfly_tests`
const targetFor = url => migrationTarget({ CANFLY_MIGRATION_DATABASE_URL: url })

test('target guards require an explicit approved URL and prohibit connection overrides', () => {
  assert.throws(() => migrationTarget({ DATABASE_URL: local }), /explicitly/)
  assert.equal(targetFor(local).label, '127.0.0.1:55432/canfly_e2e_migration_system')
  assert.equal(targetFor(`${neon}?sslmode=require&channel_binding=require`).label, `${host}/canfly_tests`)
  for (const url of [
    local.replace('127.0.0.1', 'localhost'), local.replace(':55432', ''),
    local.replace('canfly_e2e_migration_system', 'canfly'),
    `${local}?host=other`, `${local}?options=-c`,
    neon.replace(host, host.replace('.c-15', '-pooler.c-15')),
    neon.replace(host, 'ep-other.c-15.us-east-1.aws.neon.tech'),
    neon.replace('canfly_tests', 'production'),
    `${neon}?sslmode=disable`, `${neon}?sslmode=require&sslmode=require`,
    `${neon}?hostaddr=127.0.0.1`, `${neon}?channel_binding=disable`,
  ]) assert.throws(() => targetFor(url))
})

test('write confirmation is required before connecting and errors suppress secrets', () => {
  const env = { ...process.env, CANFLY_MIGRATION_DATABASE_URL: neon }
  for (const command of ['up', 'baseline']) {
    assert.throws(() => migrationRequest(command, ['--confirm=invalid'], env), error => {
      assert.match(migrationError(error), /Pass --confirm=/)
      assert.doesNotMatch(migrationError(error), /dummy|postgresql:/)
      return true
    })
    assert.doesNotThrow(() => migrationRequest(command, [`--confirm=${host}/canfly_tests`], env))
  }
  assert.equal(migrationError(new Error(neon)), 'Migration command failed')
})

test('migration files are loaded in order and hashed byte for byte', async t => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'canfly-migration-plan-'))
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))
  const directory = pathToFileURL(fixtureDir + '/')
  const first = join(fixtureDir, '0001_first.sql')
  const second = join(fixtureDir, '0002_second.sql')
  await writeFile(second, 'SELECT 2;\n')
  await assert.rejects(readMigrationPlan(directory), /version 0001/)
  await writeFile(first, 'SELECT 1;\n')
  const plan = await readMigrationPlan(directory)
  assert.deepEqual(plan.map(migration => migration.version), ['0000', '0001', '0002'])
  assert.match(plan[0].checksum, /^[0-9a-f]{64}$/)
  await writeFile(first, 'SELECT 1;\r\n')
  assert.notEqual((await readMigrationPlan(directory))[1].checksum, plan[1].checksum)
  await writeFile(join(fixtureDir, '0001_duplicate.sql'), 'SELECT 1;\n')
  await assert.rejects(readMigrationPlan(directory), /version 0002/)
})

const testUrl = process.env.CANFLY_MIGRATION_TEST_DATABASE_URL
const neonOnly = process.argv.includes('--neon')
if (neonOnly) {
  test('Neon integration checks PostgreSQL, migration state and advisory locking', async t => {
    const target = migrationTarget(process.env)
    assert.equal(target.label, `${host}/canfly_tests`)
    const client = await openMigrationTarget(target)
    t.after(() => client.end())
    const contender = await openMigrationTarget(target)
    t.after(() => contender.end())

    const status = await runMigrations(client, 'status')
    const verification = await runMigrations(client, 'verify')
    assert.match(status[0], /^0000\.sql: (unregistered|applied at )/)
    assert.match(verification[0], /^Journal integrity verified:/)
    if (!status.slice(1).some(line => line.includes(': applied at '))) {
      assert.ok(verification.includes('Baseline manifest matches (14 categories)'))
    }
    const lock = await contender.query('SELECT pg_try_advisory_lock(4865638142842026000::bigint) AS acquired')
      .catch(() => { throw new Error('Neon advisory lock query failed') })
    assert.equal(lock.rows[0].acquired, true)
    try {
      await assert.rejects(runMigrations(client, 'verify'), /holds the database lock/)
    } finally {
      await contender.query('SELECT pg_advisory_unlock(4865638142842026000::bigint)')
        .catch(() => { throw new Error('Neon advisory unlock query failed') })
    }
  })
}

test('PostgreSQL migration lifecycle on a disposable baseline database', {
  skip: neonOnly || (!testUrl && 'Set CANFLY_MIGRATION_TEST_DATABASE_URL for PostgreSQL integration'),
}, async t => {
  const target = targetFor(testUrl)
  assert.equal(target.config.host, '127.0.0.1')
  assert.equal(target.database, 'canfly_e2e_migration_system')
  const fixtureDir = await mkdtemp(join(tmpdir(), 'canfly-migrations-'))
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))
  const directory = pathToFileURL(fixtureDir + '/')
  const client = await openMigrationTarget(target)
  t.after(() => client.end())

  const run = command => runMigrations(client, command, directory)
  const sql = (name, contents) => writeFile(join(fixtureDir, name), contents)
  const lookup = async name => (await client.query('SELECT to_regclass($1) AS relation', [name])).rows[0].relation
  const journal = 'canfly_migrations.schema_migrations'
  const appliedVersions = async () => (await client.query(`SELECT version FROM ${journal} ORDER BY version`))
    .rows.map(row => row.version)

  assert.deepEqual(await run('status'), ['0000.sql: unregistered'])
  await assert.rejects(run('up'), /Register the baseline/)
  assert.match((await run('verify')).join('\n'), /matches \(14 categories\)/)
  assert.equal(await lookup(journal), null)

  await client.query('CREATE TABLE public.migration_drift_fixture (id integer)')
  await assert.rejects(run('baseline'), /manifest differs/)
  assert.equal(await lookup(journal), null)
  await client.query('DROP TABLE public.migration_drift_fixture')

  assert.match((await run('baseline'))[0], /Registered baseline/)
  assert.deepEqual(await run('baseline'), ['Baseline already registered'])
  assert.match((await run('verify')).join('\n'), /matches \(14 categories\)/)
  assert.deepEqual(await appliedVersions(), ['0000'])

  const contender = await openMigrationTarget(target)
  t.after(() => contender.end())
  await contender.query('SELECT pg_advisory_lock(4865638142842026000::bigint)')
  try {
    await assert.rejects(run('up'), /holds the database lock/)
  } finally {
    await contender.query('SELECT pg_advisory_unlock(4865638142842026000::bigint)')
  }

  const firstName = '0001_fixture.sql'
  const secondName = '0002_fixture.sql'
  const firstSql = `
    -- An ordinary SQL script can contain dollar-quoted bodies and multiple statements.
    CREATE SCHEMA migration_fixture;
    CREATE TABLE migration_fixture.first (id integer);
    INSERT INTO migration_fixture.first VALUES (1);
    DO $$ BEGIN PERFORM '$sql_0$'; END; $$;
  `
  await sql(secondName, 'SELECT 1')
  await assert.rejects(run('status'), /exactly one SQL file for version 0001/)
  await sql(firstName, firstSql)
  await sql(secondName, 'CREATE TABLE migration_fixture.second (id integer); SELECT 1 / 0;')
  await assert.rejects(run('up'), /Migration 0002 failed \(22012\)/)
  assert.deepEqual(await appliedVersions(), ['0000', '0001'])
  assert.equal(await lookup('migration_fixture.second'), null)
  assert.equal((await client.query('SELECT count(*)::integer AS count FROM migration_fixture.first')).rows[0].count, 1)

  for (const forbidden of ['COMMIT;', 'ROLLBACK;', 'CREATE INDEX CONCURRENTLY fixture_idx ON migration_fixture.first (id);']) {
    await sql(secondName, `CREATE TABLE migration_fixture.second (id integer); ${forbidden}`)
    await assert.rejects(run('up'), /Migration 0002 failed/)
    assert.equal(await lookup('migration_fixture.second'), null)
    assert.deepEqual(await appliedVersions(), ['0000', '0001'])
  }

  await sql(secondName, 'CREATE TABLE migration_fixture.second (id integer);')
  assert.deepEqual(await run('up'), ['Applied 0002_fixture.sql'])
  assert.deepEqual(await run('up'), ['No pending migrations'])
  assert.deepEqual(await appliedVersions(), ['0000', '0001', '0002'])
  assert.deepEqual(await run('verify'), ['Journal integrity verified: 3 applied, 0 pending'])
  assert.match((await run('status'))[2], /applied at/)

  await sql(firstName, firstSql + '\n-- modified')
  for (const command of ['status', 'verify', 'up', 'baseline']) {
    await assert.rejects(run(command), /Applied migration 0001 has a different filename or checksum/)
  }
  await sql(firstName, firstSql)
  await rm(join(fixtureDir, secondName))
  await assert.rejects(run('verify'), /Journal history diverges at version 0002/)
})
