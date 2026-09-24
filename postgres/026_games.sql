-- 026: Games — небольшие веб-игры вселенной canfly
-- Миграция обратима: DROP TABLE character_games, release_games, games.

-- === Новая таблица ===

CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  cover_image TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9'
    CHECK (aspect_ratio IN ('16:9', '4:3', '1:1', '9:16')),
  display_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.release_games (
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  PRIMARY KEY (release_id, game_id)
);

CREATE TABLE IF NOT EXISTS public.character_games (
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, game_id)
);

-- === Триггеры ===

DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- === Индексы ===

CREATE INDEX IF NOT EXISTS idx_games_slug ON public.games(slug);
CREATE INDEX IF NOT EXISTS idx_release_games_release ON public.release_games(release_id);
CREATE INDEX IF NOT EXISTS idx_release_games_game ON public.release_games(game_id);
CREATE INDEX IF NOT EXISTS idx_character_games_character ON public.character_games(character_id);
CREATE INDEX IF NOT EXISTS idx_character_games_game ON public.character_games(game_id);
