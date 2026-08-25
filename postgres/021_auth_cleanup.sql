-- 021: чистка устаревших таблиц и подготовка OAuth-соцсетей
--
-- Что происходит:
--   * мульти-email (user_emails + email_verifications) убирается — единственным
--     ключом входа остаётся users.email; primary-адреса переносятся в users.email
--     для OAuth-пользователей, у которых адрес был только в user_emails.
--   * архивные таблицы legacy-системы книг (books, book_characters) и магазина
--     (orders) удаляются — живого кода к ним нет, e2e legacy проверяет только
--     HTTP-поведение (301/retired) и не трогает БД.
--   * admins (легаси, по email, без связи с users) удаляется.
--   * linked_accounts.url — публичный URL профиля провайдера (github/twitter),
--     который показывается на странице автора как соцсеть и уходит в Person.sameAs.

-- ── 1. Перенос primary-email из user_emails в users.email ─────────────
-- Только для пользователей без email. Приоритет: основной → подтверждённый → самый старый.
UPDATE public.users u
SET email = e.email
FROM (
  SELECT DISTINCT ON (user_id)
         user_id, email
  FROM public.user_emails
  ORDER BY user_id,
           is_primary DESC,
           verified DESC,
           created_at ASC
) e
WHERE u.id = e.user_id
  AND u.email IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users u2 WHERE u2.email = e.email
  );

-- ── 2. Удаление мульти-email ───────────────────────────────────────────
DROP TABLE IF EXISTS public.email_verifications;
DROP TABLE IF EXISTS public.user_emails;

-- ── 3. Удаление архивных legacy-таблиц книг и магазина ────────────────
-- FK-порядок: book_characters ссылается на books.
DROP TABLE IF EXISTS public.book_characters;
DROP TABLE IF EXISTS public.books;
DROP TABLE IF EXISTS public.orders;

-- ── 4. Легаси-таблица админов (по email, без связи с users) ───────────
DROP TABLE IF EXISTS public.admins;

-- ── 5. Публичный URL привязанного аккаунта (соцсеть автора) ───────────
ALTER TABLE public.linked_accounts
  ADD COLUMN IF NOT EXISTS url TEXT;
