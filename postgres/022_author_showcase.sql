-- 022_author_showcase.sql
-- Автор выбирает порядок и набор работ на публичной странице /user/[slug].
-- NULL = показать все (fallback текущего поведения).
-- Пустой массив = ничего. Непустой = только указанные ID в указанном порядке.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS showcase_releases UUID[] DEFAULT NULL;
