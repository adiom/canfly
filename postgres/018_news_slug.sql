-- 018_news_slug.sql
-- SEO-friendly slug для новостей вместо UUID в URL.

-- 1. Функция транслитерации: кириллица → латиница + kebab-case.
CREATE OR REPLACE FUNCTION transliterate_news_title(input TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  c TEXT;
  cyrillic_map JSONB := '{
    "А":"A","Б":"B","В":"V","Г":"G","Д":"D","Е":"E","Ё":"Yo","Ж":"Zh","З":"Z",
    "И":"I","Й":"Y","К":"K","Л":"L","М":"M","Н":"N","О":"O","П":"P","Р":"R",
    "С":"S","Т":"T","У":"U","Ф":"F","Х":"Kh","Ц":"Ts","Ч":"Ch","Ш":"Sh",
    "Щ":"Shch","Ъ":"","Ы":"Y","Ь":"","Э":"E","Ю":"Yu","Я":"Ya",
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z",
    "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
    "с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh",
    "щ":"shch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
    "і":"i","ї":"yi","є":"ye","ґ":"g"
  }'::jsonb;
BEGIN
  FOR i IN 1..LENGTH(input) LOOP
    c := SUBSTRING(input FROM i FOR 1);

    IF cyrillic_map ? c THEN
      result := result || (cyrillic_map ->> c);
    ELSIF c ~ '[A-Za-z0-9]' THEN
      result := result || LOWER(c);
    ELSIF c ~ '[ \-_]' THEN
      result := result || '-';
    END IF;
  END LOOP;

  result := REGEXP_REPLACE(result, '-{2,}', '-', 'g');
  result := REGEXP_REPLACE(result, '^-|-$', '', 'g');

  RETURN COALESCE(
    NULLIF(result, ''),
    'post-' || gen_random_uuid()::text
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 2. Добавляем slug.
ALTER TABLE news_posts
  ADD COLUMN IF NOT EXISTS slug TEXT;


-- 3. Генерируем slug для существующих новостей.
UPDATE news_posts
SET slug = transliterate_news_title(title)
WHERE slug IS NULL;


-- 4. Безопасно устраняем дубли.
WITH duplicates AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (
      PARTITION BY slug
      ORDER BY created_at, id
    ) AS rn
  FROM news_posts
)
UPDATE news_posts n
SET slug = d.slug || '-' || d.rn
FROM duplicates d
WHERE n.id = d.id
  AND d.rn > 1;


-- 5. Проверяем, что NULL больше нет.
ALTER TABLE news_posts
  ALTER COLUMN slug SET NOT NULL;


-- 6. Уникальность slug.
ALTER TABLE news_posts
  ADD CONSTRAINT news_posts_slug_unique UNIQUE (slug);


-- 7. Индекс для быстрого поиска по slug.
CREATE INDEX IF NOT EXISTS idx_news_posts_slug
  ON news_posts(slug);


-- 8. Функция больше не нужна.
DROP FUNCTION transliterate_news_title;