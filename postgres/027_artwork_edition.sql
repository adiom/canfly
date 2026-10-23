-- Формат самостоятельной картины: отдельное изображение на уровне издания.
ALTER TYPE public.edition_format ADD VALUE IF NOT EXISTS 'artwork';

ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS artwork_url TEXT;
