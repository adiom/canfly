-- 010_releases_pagination_indexes.sql
-- Индексы для пагинации /releases (Feature #11)
-- Составные индексы покрывают最常见的 запросы ORDER BY + WHERE status

-- Сортировка опубликованных релизов по дате (основной листинг /releases)
CREATE INDEX IF NOT EXISTS idx_releases_status_date
  ON public.releases (status, release_date DESC NULLS LAST, created_at DESC);

-- Фильтр изданий по формату при серверной фильтрации категорий
CREATE INDEX IF NOT EXISTS idx_editions_release_format_status
  ON public.editions (release_id, format, status);
