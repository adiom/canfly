import { openMigrationTarget, migrationRequest, runMigrations, migrationError } from './db-migrations.mjs'

async function main([command, ...args]) {
  const target = migrationRequest(command, args, process.env)
  const client = await openMigrationTarget(target)
  try {
    for (const line of await runMigrations(client, command)) console.log(line)
  } finally {
    await client.end()
  }
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  console.error(migrationError(error))
  process.exitCode = 1
}
