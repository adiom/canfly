-- 030: флаг видимости релиза на странице каталога /releases
--
-- Отдельно от release_status: draft/published отвечают за публикацию целиком,
-- а этот флаг — только за попадание в общий список каталога. Скрытый релиз
-- остаётся доступен по прямой ссылке /release/[slug], в поиске, sitemap
-- и на страницах серий/персонажей — фильтрируется единственный запрос
-- fetchReleasesPage (см. инвариант в lib/server/releases.ts).
--
-- Дефолт true, чтобы существующие релизы остались видимыми:
-- скрытие из каталога — осознанное действие автора, а не новое правило.

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS show_in_catalog BOOLEAN NOT NULL DEFAULT true;

-- Отдельный индекс не нужен: фильтр ложится поверх idx_releases_status_date
-- (status, release_date DESC NULLS LAST, created_at DESC) из миграции 010.
