-- 016: Character wall — reader→character public messages
-- Перенесено из scripts/007_character_social.sql (было вне postgres/ миграций).
-- Идемпотентная миграция.

-- Отложенная публикация постов персонажа
ALTER TABLE public.character_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS author_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_character_posts_visible
  ON public.character_posts (character_id, COALESCE(scheduled_at, created_at) DESC);

-- Стена: публичные сообщения читателей на стену персонажа
CREATE TABLE IF NOT EXISTS public.character_wall_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  content      TEXT NOT NULL,
  hidden       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_wall_posts_visible
  ON public.character_wall_posts (character_id, hidden, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_wall_posts_user
  ON public.character_wall_posts (user_id);

DROP TRIGGER IF EXISTS update_character_wall_posts_updated_at ON public.character_wall_posts;
CREATE TRIGGER update_character_wall_posts_updated_at
  BEFORE UPDATE ON public.character_wall_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
