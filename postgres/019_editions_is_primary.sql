-- 019: синхронизация схемы editions с живой БД + инварианты quality_tier
--
-- Колонка is_primary давно есть в продовой базе, но её не создавала ни одна
-- миграция: на чистой БД (schema.sql + 002…018) createEdition падал с
-- `column "is_primary" does not exist`. Закрываем дрейф.
--
-- quality_tier из 005 — обычный TEXT без ограничений, хотя TS обещает союз
-- 'draft' | 'standard' | 'premium'. Добавляем CHECK, предварительно приведя
-- существующие значения в порядок (иначе ADD CONSTRAINT упадёт).

ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Бэкфилл тиража для изданий, созданных после появления бага в studio-форме:
-- тираж не сохранялся и оставался 'standard', выбор автора жил только в слаге.
UPDATE public.editions
SET quality_tier = 'draft'
WHERE format = 'book' AND slug LIKE 'web-draft%' AND quality_tier <> 'draft';

UPDATE public.editions
SET quality_tier = 'premium'
WHERE format = 'book' AND slug LIKE 'premium%' AND quality_tier <> 'premium';

-- Всё, что не входит в союз, приводим к дефолту — иначе CHECK не создастся.
UPDATE public.editions
SET quality_tier = 'standard'
WHERE quality_tier NOT IN ('draft', 'standard', 'premium');

DO $$
BEGIN
  ALTER TABLE public.editions
    ADD CONSTRAINT editions_quality_tier_check
    CHECK (quality_tier IN ('draft', 'standard', 'premium'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
