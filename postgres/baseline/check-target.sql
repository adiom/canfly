DO $$
BEGIN
  IF current_database() !~ '^canfly_e2e_[a-z0-9_]+$' OR inet_server_addr() IS NULL THEN
    RAISE EXCEPTION 'Expected a disposable canfly_e2e_* database over TCP';
  END IF;
  IF current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'The Canfly baseline requires PostgreSQL 17';
  END IF;
  IF current_setting('server_encoding') <> 'UTF8' OR NOT EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = current_database()
      AND datlocprovider = 'b'
      AND datlocale = 'C.UTF-8'
      AND datcollate = 'C.UTF-8'
      AND datctype = 'C.UTF-8'
  ) THEN
    RAISE EXCEPTION 'Expected a UTF8 database with builtin C.UTF-8 locale';
  END IF;
END;
$$;
