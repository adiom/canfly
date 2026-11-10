-- 034: Editable SEO metadata for game landing pages.
-- Existing games keep their generated title/description and remain indexable.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_noindex BOOLEAN NOT NULL DEFAULT FALSE;
