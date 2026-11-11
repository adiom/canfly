-- Stable keyset pagination for the mixed public /v2 journal.
CREATE INDEX IF NOT EXISTS chapters_feed_page ON chapters(created_at DESC, id DESC)
  WHERE status='published';
CREATE INDEX IF NOT EXISTS places_feed_page ON places(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS character_relationships_feed_page ON character_relationships(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS character_posts_feed_page ON character_posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS chapter_highlights_feed_page ON chapter_highlights(created_at DESC, id DESC)
  WHERE is_public AND publication IS NOT NULL;
