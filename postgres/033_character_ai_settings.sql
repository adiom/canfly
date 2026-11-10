-- 033 — технические настройки AI-чата персонажа (этап 02).
--
-- Аддитивная миграция: не меняет существующие таблицы и не переносит данные.
-- Единственная копия технических параметров вызова модели. Авторская
-- инструкция остаётся в characters.system_role, доступность выводится из
-- существующих полей (reply_mode, can_receive_messages, system_role,
-- character_friendships.status) и здесь не дублируется.
--
-- Значения по умолчанию совпадают с CHARACTER_CHAT_CONFIG из
-- lib/ai/character-chat/config.ts. Отсутствие строки для персонажа — это
-- документированный default, а не ошибка: runtime читает settings через
-- resolveCharacterAiRuntimeConfig() и падает на default при schema = 'missing'.
--
-- Применять только на согласованной БД: аддитивная, откат — DROP TABLE
-- character_ai_settings (пользовательские сообщения и персонажи не затрагиваются).

BEGIN;

CREATE TABLE IF NOT EXISTS character_ai_settings (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
  temperature DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  max_output_tokens INTEGER NOT NULL DEFAULT 1024,
  total_timeout_ms INTEGER NOT NULL DEFAULT 45000,
  chunk_timeout_ms INTEGER NOT NULL DEFAULT 10000,
  user_turns_per_hour INTEGER NOT NULL DEFAULT 60,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_ai_settings_model_approved
    CHECK (model_id IN ('openai/gpt-4o-mini')),
  CONSTRAINT character_ai_settings_temperature_range
    CHECK (temperature >= 0 AND temperature <= 1.5),
  CONSTRAINT character_ai_settings_output_range
    CHECK (max_output_tokens >= 128 AND max_output_tokens <= 4096),
  CONSTRAINT character_ai_settings_total_timeout_range
    CHECK (total_timeout_ms >= 5000 AND total_timeout_ms <= 120000),
  CONSTRAINT character_ai_settings_chunk_timeout_range
    CHECK (chunk_timeout_ms >= 1000 AND chunk_timeout_ms <= 60000),
  -- Пара таймаутов должна быть осмысленной: пауза между чанками меньше
  -- общего лимита. Runtime дополнительно проверяет это в merge.
  CONSTRAINT character_ai_settings_timeout_pair
    CHECK (chunk_timeout_ms < total_timeout_ms),
  CONSTRAINT character_ai_settings_turns_range
    CHECK (user_turns_per_hour >= 1 AND user_turns_per_hour <= 600),
  CONSTRAINT character_ai_settings_revision_positive
    CHECK (revision >= 1)
);

COMMENT ON TABLE character_ai_settings IS
  'Технические параметры одного хода AI-чата персонажа. Единственный источник model/temperature/limits для Studio и runtime.';
COMMENT ON COLUMN character_ai_settings.revision IS
  'Растёт при каждом сохранении через Studio; используется для отката на прежнюю настройку.';
COMMENT ON COLUMN character_ai_settings.updated_by IS
  'Администратор, сохранивший настройку. NULL — строка создана вне Studio (SQL/миграция).';
COMMENT ON COLUMN character_ai_settings.user_turns_per_hour IS
  'Лимит ходов одного читателя в час. Это не денежный бюджет: стоимость не учитывается.';

COMMIT;
