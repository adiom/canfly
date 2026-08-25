-- 024: Частичный индекс для выборки главных персонажей
--
-- Дефолтная выдача /characters теперь = role = 'main' (главные герои
-- какого-либо опубликованного релиза). Без отдельного индекса этот запрос
-- сканировал бы всю таблицу release_characters. Частичный индекс покрывает
-- только строки с role = 'main' — удобно, когда большинство связей —
-- 'supporting'/'cameo'.
--
-- Идемпотентен; обратимой модели нет (DROP INDEX IF EXISTS — при откате).

CREATE INDEX IF NOT EXISTS idx_release_characters_main
  ON public.release_characters (character_id)
  WHERE role = 'main';
