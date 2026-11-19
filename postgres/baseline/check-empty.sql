SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

DO $$
BEGIN
  -- Serialize concurrent bootstrap commands for this database.
  PERFORM pg_advisory_xact_lock(hashtext('canfly-test-baseline'), 0);
  IF to_regnamespace('public') IS NULL OR EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname NOT IN ('public', 'information_schema')
      AND left(nspname, 3) <> 'pg_'
  ) OR EXISTS (
    SELECT 1
    FROM pg_depend
    WHERE refclassid = 'pg_namespace'::regclass
      AND refobjid = to_regnamespace('public')
  ) OR EXISTS (
    SELECT 1 FROM pg_extension WHERE extname <> 'plpgsql'
  ) THEN
    RAISE EXCEPTION 'Bootstrap requires an empty database created from template0';
  END IF;
END;
$$;
