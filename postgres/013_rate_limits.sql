-- Migration: счётчик обращений для rate limiting
--
-- Внешнего Redis в проекте нет, а защищать нужно немного точек (LLM-ручки,
-- чат с персонажем). Postgres здесь достаточно: окно фиксированное, ключ —
-- (bucket, subject, window_start), инкремент атомарный через ON CONFLICT.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket VARCHAR(64) NOT NULL,
  subject VARCHAR(128) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, window_start)
);

-- Для периодической уборки просроченных окон
CREATE INDEX IF NOT EXISTS rate_limits_window_idx
  ON public.rate_limits(window_start);
