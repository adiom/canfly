-- 011_news_studio.sql
-- Перенос новостей в Canfly Studio: автор, статус, обложка, дата публикации.
-- content TEXT переиспользуется под HTML (Tiptap) — обратно совместимо с plain-text.

ALTER TABLE news_posts
  ADD COLUMN IF NOT EXISTS author_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cover_image TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: is_active → status
UPDATE news_posts
  SET status = CASE WHEN is_active THEN 'published' ELSE 'draft' END
  WHERE status = 'draft' AND is_active IS NOT NULL;

-- Backfill: author_user_id — первый admin-юзер
UPDATE news_posts
  SET author_user_id = (
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
    ORDER BY u.created_at ASC
    LIMIT 1
  )
  WHERE author_user_id IS NULL;

-- Backfill: published_at для уже опубликованных
UPDATE news_posts
  SET published_at = created_at
  WHERE status = 'published' AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_news_posts_author ON news_posts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_status ON news_posts(status);
CREATE INDEX IF NOT EXISTS idx_news_posts_published ON news_posts(status, published_at DESC);
