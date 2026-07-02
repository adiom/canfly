-- Soft-delete для пользователей (is_deleted + deleted_at)
-- Удаление в админке только помечает пользователя как скрытого;
-- строка из БД не удаляется.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON public.users (is_deleted)
  WHERE is_deleted = TRUE;
