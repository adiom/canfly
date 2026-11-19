import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { requireE2eDatabaseUrl } from '../e2e/setup/environment.ts'

const baselineDir = new URL('../postgres/baseline/', import.meta.url)

function psql(url, files, readOnly = false) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('PG')),
  )
  // Strip libpq overrides such as PGHOSTADDR, PGSERVICE and PGOPTIONS.
  Object.assign(env, {
    PGHOST: url.hostname,
    PGPORT: url.port,
    PGDATABASE: url.pathname.slice(1),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGCONNECT_TIMEOUT: '5',
    PGSSLMODE: 'disable',
    PGGSSENCMODE: 'disable',
    PGOPTIONS: '-c search_path=pg_catalog',
  })
  const args = [
    '-X', '--no-password', '--set=ON_ERROR_STOP=1', '--single-transaction',
    '--quiet', '--no-align', '--tuples-only',
  ]
  if (readOnly) args.push('--command=SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  for (const file of ['check-target.sql', ...files]) {
    args.push('--file', fileURLToPath(new URL(file, baselineDir)))
  }
  const result = spawnSync('psql', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`psql failed (${result.status ?? result.signal})`)
  return result.stdout
}

function verify(url) {
  const expected = JSON.parse(readFileSync(new URL('production-manifest.json', baselineDir), 'utf8'))
  const actual = JSON.parse(psql(url, ['catalog.sql'], true))
  const categories = new Set([...Object.keys(expected), ...Object.keys(actual)])
  let matches = true
  for (const category of categories) {
    const expectedRows = expected[category]
    const actualRows = actual[category]
    if (!expectedRows || !actualRows) {
      matches = false
      console.error(`Catalog category differs: ${category}`)
      continue
    }
    const missing = expectedRows.filter(row => !actualRows.some(actualRow => isDeepStrictEqual(row, actualRow)))
    const unexpected = actualRows.filter(row => !expectedRows.some(expectedRow => isDeepStrictEqual(row, expectedRow)))
    if (missing.length === 0 && unexpected.length === 0) continue

    matches = false
    console.error(`${category}: ${missing.length} expected entries absent, ${unexpected.length} unexpected entries`)
    for (const row of missing.slice(0, 5)) console.error('-', JSON.stringify(row))
    for (const row of unexpected.slice(0, 5)) console.error('+', JSON.stringify(row))
  }
  if (!matches) throw new Error('Schema differs from the production manifest')
  console.log(`Schema of ${url.pathname.slice(1)} matches the production manifest`)
}

try {
  const command = process.argv[2]
  if (command !== 'bootstrap' && command !== 'verify') throw new Error('Expected bootstrap or verify')
  const url = new URL(requireE2eDatabaseUrl())
  if (command === 'bootstrap') {
    psql(url, ['check-empty.sql', '0000.sql'])
    console.log(`Bootstrapped ${url.pathname.slice(1)}`)
  } else {
    verify(url)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
