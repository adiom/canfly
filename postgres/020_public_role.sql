-- 020: публичная роль (public_role) и системный флаг админа (is_admin)
--
-- Модель ролей разделяется на два независимых слоя:
--   * public_role (users.public_role) — единственная публичная роль, видимая
--     на профиле и в SEO: reader (личный читательский профиль) или author
--     (публичная страница автора). editor публичного профиля не имеет.
--   * is_admin (users.is_admin) — системный флаг доступа к /admin.
--   * user_roles остаётся таблицей внутренних разрешений (прежде всего editor).
--
-- Миграция безопасна: бэкфилл не трогает права, а только заполняет новые поля
-- из существующих данных.

DO $$
BEGIN
  CREATE TYPE public.public_role AS ENUM ('reader', 'author');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_role public.public_role NOT NULL DEFAULT 'reader',
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Бэкфилл public_role: был author → author, иначе editor → reader
-- (editor публичного профиля не имеет), иначе reader.
UPDATE public.users u
SET public_role = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = u.id AND ur.role = 'author'
  ) THEN 'author'::public.public_role
  ELSE 'reader'::public.public_role
END;

-- Бэкфилл is_admin: роль admin переносим во флаг и убираем из user_roles,
-- чтобы user_roles больше не содержала публичные/админские роли.
UPDATE public.users u
SET is_admin = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = u.id AND ur.role = 'admin'
);

DELETE FROM public.user_roles WHERE role = 'admin';

-- Публичные роли в user_roles больше не живут: после переноса public_role
-- записи author/reader в user_roles не нужны (public_role у всех заполнен).
-- editor и прочие будущие системные права остаются.
DELETE FROM public.user_roles WHERE role IN ('reader', 'author');

-- Ускорение выборок по публичной роли (страницы авторов).
CREATE INDEX IF NOT EXISTS idx_users_public_role
  ON public.users (public_role)
  WHERE is_deleted = FALSE;

-- Остаток в user_roles — только системные права (editor).
-- Дефолт 'reader' в user_roles больше неактуален и вводит в заблуждение.
ALTER TABLE public.user_roles
  ALTER COLUMN role DROP DEFAULT;
