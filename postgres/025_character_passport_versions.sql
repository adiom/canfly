-- 025: Character passport versions
-- Версионность паспорта персонажа по образцу chapter_versions (002).
-- Паспорт остаётся markdown-текстом в characters.passport; при каждом изменении
-- старое содержимое уходит в эту таблицу. Удаление персонажа каскадно чистит
-- версии (ON DELETE CASCADE). Idempotent.

CREATE TABLE IF NOT EXISTS public.character_passport_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passport_versions_character
  ON public.character_passport_versions(character_id);

CREATE INDEX IF NOT EXISTS idx_passport_versions_number
  ON public.character_passport_versions(character_id, version_number DESC);
