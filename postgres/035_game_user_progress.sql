-- 035: Minimal per-user Canfly Game API storage.
-- Requires 026_games.sql and existing public.users.
CREATE TABLE IF NOT EXISTS public.game_user_scores (
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_score INTEGER,
  best_score INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.game_user_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  kind VARCHAR(32) NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]{0,31}$'),
  score INTEGER CHECK (score BETWEEN 0 AND 1000000000),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_game_user_events_recent
  ON public.game_user_events (game_id, user_id, created_at DESC, id DESC);
