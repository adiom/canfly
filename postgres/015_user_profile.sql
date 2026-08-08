-- 015: Профиль читателя (/user, /user-settings, /user/[slug])
-- Идемпотентная миграция

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS signature_color TEXT,
  ADD COLUMN IF NOT EXISTS profile_is_public BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_reading BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS handle_changed_at TIMESTAMPTZ;

-- users.handle уже UNIQUE, но регистрозависимо: @Adiom и @adiom — разные строки,
-- а публичный маршрут /user/[slug] ищет по LOWER(handle) и вернул бы случайного
-- из двух. Индекс закрывает эту дыру на уровне БД.
-- Если создание падает — в данных уже есть коллизия, её нужно разобрать вручную.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_lower
  ON public.users (LOWER(handle)) WHERE is_deleted = FALSE;

-- Публичная страница отбирает цитаты пользователя по is_public
CREATE INDEX IF NOT EXISTS idx_chapter_highlights_user_public
  ON public.chapter_highlights (user_id, is_public, created_at DESC);

-- Полка «читает»: последняя запись прогресса по каждому изданию
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_recent
  ON public.reading_progress (user_id, last_read_at DESC)
  WHERE user_id IS NOT NULL;
