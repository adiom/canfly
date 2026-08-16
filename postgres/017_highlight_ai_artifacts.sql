-- 017: результаты AI-инструментов над цитатой (Объясни / Смысл / Перепиши / Нарисуй)
--
-- Раньше эти четыре ручки только стримили текст/картинку в UI попапа
-- HighlightArtifact — при закрытии попапа результат терялся безвозвратно.
-- Теперь он привязывается к самой цитате (chapter_highlights), а не живёт
-- отдельной таблицей: артефактов на цитату всегда мало и с фиксированной
-- структурой (explain, meaning, до 3 вариантов rewrite, illustrate),
-- запрашивать их отдельно от цитаты незачем — тот же профиль использования,
-- что у releases.design_config и characters.abilities.

ALTER TABLE public.chapter_highlights
  ADD COLUMN IF NOT EXISTS ai_artifacts JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Форма ai_artifacts:
-- {
--   "explain":    { "content": "...", "updated_at": "2026-08-17T12:00:00Z" },
--   "meaning":    { "content": "...", "updated_at": "..." },
--   "illustrate": { "image_url": "...", "prompt": "...", "updated_at": "..." },
--   "rewrite": {
--     "другой-финал": { "content": "...", "updated_at": "..." },
--     "другая-эпоха": { "content": "...", "updated_at": "..." },
--     "другой-стиль": { "content": "...", "updated_at": "..." }
--   }
-- }
