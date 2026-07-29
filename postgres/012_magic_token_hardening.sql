-- Migration: усиление magic-link авторизации
--
-- 1. link_token — длинный CSPRNG-токен для входа по ссылке /hi/<token>.
--    8-значный код остаётся только для ручного ввода, где он защищён
--    привязкой к email и счётчиком попыток. Вслепую по ссылке подобрать
--    8 цифр было реально — 32 байта уже нет.
-- 2. attempts — счётчик неудачных проверок кода по email.

ALTER TABLE public.magic_tokens
  ADD COLUMN IF NOT EXISTS link_token VARCHAR(64);

ALTER TABLE public.magic_tokens
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS magic_tokens_link_token_idx
  ON public.magic_tokens(link_token)
  WHERE link_token IS NOT NULL;

-- Активные токены ищутся по email при инкременте счётчика попыток
CREATE INDEX IF NOT EXISTS magic_tokens_email_active_idx
  ON public.magic_tokens(email)
  WHERE used = false;

-- Тот же счётчик попыток для кодов подтверждения email
ALTER TABLE public.email_verifications
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
