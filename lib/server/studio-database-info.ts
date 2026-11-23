import 'server-only'

import { dbQueryOne, getPool } from '@/lib/db'

export interface StudioDatabaseInfo {
  name: string
  hostname: string | null
  environment: 'Production' | 'Preview' | 'Local'
}

/** Read-only database identity for authenticated Studio administrators. */
export async function getStudioDatabaseInfo(): Promise<StudioDatabaseInfo> {
  // The name comes from PostgreSQL itself, not from an environment variable.
  const row = await dbQueryOne<{ name: string }>('SELECT current_database() AS name')

  // Inspect the same pool used for application reads; never expose its URL.
  const connectionString = getPool().options.connectionString
  let hostname: string | null = null
  if (connectionString) {
    try {
      hostname = new URL(connectionString).hostname
    } catch {
      // A non-URL connection string can still be valid for node-postgres.
    }
  }

  const environment = process.env.VERCEL_ENV === 'production'
    ? 'Production'
    : process.env.VERCEL_ENV === 'preview'
      ? 'Preview'
      : 'Local'

  return { name: row?.name ?? 'Не определена', hostname, environment }
}
