-- App catalog projection from the 2026-11-19 audit. Keep this independent of 0000.sql.
SET LOCAL search_path = public;

WITH extensions AS (
  SELECT e.extname AS name, e.extversion AS ver, n.nspname AS schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
), relations AS (
  SELECT c.relname AS name, c.relkind AS kind, c.relrowsecurity AS rls,
         c.relforcerowsecurity AS force_rls
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
), columns AS (
  SELECT c.relname AS tbl, a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ,
         a.attnotnull AS nn, pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity AS ident,
         a.attgenerated AS gen, a.attnum AS ord
  FROM pg_class c
  JOIN pg_attribute a ON a.attrelid = c.oid
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND a.attnum > 0 AND NOT a.attisdropped
), enums AS (
  SELECT t.typname AS name, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typnamespace = 'public'::regnamespace
  GROUP BY t.typname
), constraints AS (
  SELECT c.relname AS tbl, k.conname AS name, k.contype AS typ, k.convalidated AS valid,
         pg_get_constraintdef(k.oid, true) AS def
  FROM pg_constraint k
  JOIN pg_class c ON c.oid = k.conrelid
  WHERE c.relnamespace = 'public'::regnamespace
), indexes AS (
  SELECT c.relname AS tbl, i.relname AS name, x.indisvalid AS valid, x.indisready AS ready,
         pg_get_indexdef(i.oid) AS def
  FROM pg_index x
  JOIN pg_class c ON c.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE c.relnamespace = 'public'::regnamespace
), triggers AS (
  SELECT c.relname AS tbl, t.tgname AS name, t.tgenabled AS enabled,
         pg_get_triggerdef(t.oid, true) AS def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal
), functions AS (
  SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args,
         pg_get_function_result(p.oid) AS result, l.lanname AS lang,
         p.prosecdef AS secdef, md5(p.prosrc) AS body_hash, e.extname AS extension
  FROM pg_proc p
  JOIN pg_language l ON l.oid = p.prolang
  LEFT JOIN pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
  LEFT JOIN pg_extension e ON e.oid = d.refobjid
  WHERE p.pronamespace = 'public'::regnamespace AND e.extname IS NULL
), policies AS (
  SELECT schemaname, tablename, policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'public'
), sequences AS (
  SELECT c.relname AS name, format_type(s.seqtypid, NULL) AS typ, s.seqstart::text AS start,
         s.seqincrement::text AS increment, s.seqmin::text AS min, s.seqmax::text AS max,
         s.seqcache::text AS cache, s.seqcycle AS cycle, t.relname AS owned_table,
         a.attname AS owned_column
  FROM pg_sequence s
  JOIN pg_class c ON c.oid = s.seqrelid
  LEFT JOIN pg_depend d ON d.classid = 'pg_class'::regclass AND d.objid = c.oid
    AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
  LEFT JOIN pg_class t ON t.oid = d.refobjid
  LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
  WHERE c.relnamespace = 'public'::regnamespace
), cross_schema_fks AS (
  SELECT DISTINCT CASE WHEN source.nspname = 'public' THEN 'outgoing FK' ELSE 'incoming FK' END AS direction,
         source.nspname AS source_schema, target.nspname AS target_schema, c.conname AS constraint_name
  FROM pg_constraint c
  JOIN pg_class s ON s.oid = c.conrelid
  JOIN pg_class t ON t.oid = c.confrelid
  JOIN pg_namespace source ON source.oid = s.relnamespace
  JOIN pg_namespace target ON target.oid = t.relnamespace
  WHERE c.contype = 'f' AND source.nspname <> target.nspname AND 'public' IN (source.nspname, target.nspname)
), app_function AS (
  SELECT pg_get_functiondef(to_regprocedure('public.update_updated_at_column()')) AS definition
  WHERE to_regprocedure('public.update_updated_at_column()') IS NOT NULL
), db_collation AS (
  SELECT datcollate AS collate, datctype AS ctype, datlocprovider AS provider
  FROM pg_database
  WHERE datname = current_database()
), column_collations AS (
  SELECT c.relname AS tbl, a.attname AS col, n.nspname AS schema, k.collname AS collation
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_collation k ON k.oid = a.attcollation
  JOIN pg_namespace n ON n.oid = k.collnamespace
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
    AND a.attnum > 0 AND NOT a.attisdropped AND a.attcollation <> t.typcollation
)
SELECT jsonb_object_agg(category, coalesce(entries, '[]'::jsonb))
FROM (
  SELECT 'ext' AS category, jsonb_agg(extensions) AS entries FROM extensions
  UNION ALL SELECT 'rel', jsonb_agg(relations) FROM relations
  UNION ALL SELECT 'col', jsonb_agg(columns) FROM columns
  UNION ALL SELECT 'en', jsonb_agg(enums) FROM enums
  UNION ALL SELECT 'con', jsonb_agg(constraints) FROM constraints
  UNION ALL SELECT 'idx', jsonb_agg(indexes) FROM indexes
  UNION ALL SELECT 'tr', jsonb_agg(triggers) FROM triggers
  UNION ALL SELECT 'fn', jsonb_agg(functions) FROM functions
  UNION ALL SELECT 'pol', jsonb_agg(policies) FROM policies
  UNION ALL SELECT 'seq', jsonb_agg(sequences) FROM sequences
  UNION ALL SELECT 'deps', jsonb_agg(cross_schema_fks) FROM cross_schema_fks
  UNION ALL SELECT 'appfn', jsonb_agg(app_function) FROM app_function
  UNION ALL SELECT 'collation', jsonb_agg(db_collation) FROM db_collation
  UNION ALL SELECT 'colcoll', jsonb_agg(column_collations) FROM column_collations
) AS catalog;
