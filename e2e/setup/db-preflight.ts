import { createDedicatedDatabaseClient } from '@/lib/db'
import { requireE2eDatabaseUrl } from './environment'
import { pgConfig } from './pg'

export default async function verifyDbTestTarget() {
  const url = new URL(requireE2eDatabaseUrl())
  const client = createDedicatedDatabaseClient({
    ...pgConfig(url.href),
    options: '-c search_path=pg_catalog -c default_transaction_read_only=on',
  })
  try {
    await client.connect()
    const { rows: [schema] } = await client.query<{
      target: boolean
      chapter_revision: boolean
      chapter_lease: boolean
    }>(`
      SELECT
        current_database() = $1 AND inet_server_addr() = inet '127.0.0.1'
          AND inet_server_port() = $2
          AND current_setting('server_version_num')::integer / 10000 = 17 AS target,
        to_regclass('public.chapter_versions') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE a.attrelid = to_regclass('public.chapters') AND a.attname = 'revision'
              AND a.atttypid = 'pg_catalog.int4'::regtype AND a.attnotnull AND NOT a.attisdropped
              AND pg_catalog.pg_get_expr(d.adbin, d.adrelid) = '0'
          ) AND EXISTS (
            SELECT 1 FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid = to_regclass('public.chapters') AND t.tgname = 'advance_chapter_revision'
              AND t.tgfoid = to_regprocedure('public.advance_chapter_revision()')
              AND t.tgtype = 19 AND t.tgenabled IN ('O', 'A') AND NOT t.tgisinternal
          ) AS chapter_revision,
        to_regclass('public.chapter_edit_leases') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM pg_catalog.pg_constraint c
            WHERE c.conrelid = to_regclass('public.chapter_edit_leases')
              AND c.contype = 'p' AND c.conname = 'chapter_edit_leases_pkey'
          )
          AND EXISTS (
            SELECT 1 FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = to_regclass('public.chapter_edit_leases')
              AND a.attname = 'document_id' AND NOT a.attisdropped
          ) AS chapter_lease
    `, [url.pathname.slice(1), Number(url.port)])

    if (!schema.target) throw new Error('Tests require the configured disposable PostgreSQL 17 database on loopback')
    if (!schema.chapter_revision) {
      throw new Error('DB test schema lacks chapter revision support. Bootstrap the baseline and apply versioned migrations to the disposable database.')
    }
    if (!schema.chapter_lease) {
      throw new Error('DB test schema lacks chapter edit leases. Apply versioned migrations to the disposable database.')
    }
  } finally {
    await client.end()
  }
}
