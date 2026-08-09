-- 014: Добавляем формат 'digital' (цифровой релиз — книги на сторонних площадках)
DO $$ BEGIN
  ALTER TYPE public.edition_format ADD VALUE IF NOT EXISTS 'digital';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
