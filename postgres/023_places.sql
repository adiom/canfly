-- 023: Places — отдельная сущность для городов/локаций
-- Миграция обратима: DROP TABLE places, release_places, character_places;
-- данные в characters остаются (не удаляются).

-- === Новые таблицы ===

CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  avatar TEXT,
  bio TEXT,
  full_description TEXT,
  map_image_url TEXT,
  theme_color TEXT,
  era TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.release_places (
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'location',
  importance_score INT NOT NULL DEFAULT 0,
  PRIMARY KEY (release_id, place_id)
);

CREATE TABLE IF NOT EXISTS public.character_places (
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'resident',
  PRIMARY KEY (character_id, place_id)
);

-- === Перенос данных ===

-- Города из characters → places
INSERT INTO public.places (id, name, slug, avatar, bio, full_description, map_image_url, created_at, updated_at)
SELECT id, name, slug, avatar, bio, full_description, map_image_url, created_at, updated_at
FROM public.characters
WHERE character_type = 'city'
ON CONFLICT (slug) DO NOTHING;

-- release_cities → release_places
INSERT INTO public.release_places (release_id, place_id, role, importance_score)
SELECT release_id, character_id, role, importance_score
FROM public.release_cities
ON CONFLICT DO NOTHING;

-- === Триггеры ===

DROP TRIGGER IF EXISTS update_places_updated_at ON public.places;
CREATE TRIGGER update_places_updated_at
  BEFORE UPDATE ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- === Индексы ===

CREATE INDEX IF NOT EXISTS idx_places_slug ON public.places(slug);
CREATE INDEX IF NOT EXISTS idx_release_places_release ON public.release_places(release_id);
CREATE INDEX IF NOT EXISTS idx_release_places_place ON public.release_places(place_id);
CREATE INDEX IF NOT EXISTS idx_character_places_character ON public.character_places(character_id);
CREATE INDEX IF NOT EXISTS idx_character_places_place ON public.character_places(place_id);
