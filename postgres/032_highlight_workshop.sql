BEGIN;
ALTER TABLE chapter_highlights
  ADD COLUMN IF NOT EXISTS anchor JSONB,
  ADD COLUMN IF NOT EXISTS draft_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS publication JSONB;

CREATE TABLE IF NOT EXISTS highlight_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES chapter_highlights(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('text','explain','meaning','rewrite','image')),
  origin TEXT NOT NULL CHECK (origin IN ('manual','ai','upload')),
  parent_id UUID REFERENCES highlight_materials(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  blob_path TEXT,
  legacy_image_url TEXT,
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (highlight_id, request_id)
);
CREATE INDEX IF NOT EXISTS highlight_materials_page ON highlight_materials(highlight_id, created_at DESC, id);
CREATE TABLE IF NOT EXISTS highlight_saves (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  highlight_id UUID NOT NULL REFERENCES chapter_highlights(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, highlight_id)
);
CREATE INDEX IF NOT EXISTS highlight_saves_page ON highlight_saves(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS highlight_generation_requests (
  highlight_id UUID NOT NULL REFERENCES chapter_highlights(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running','complete','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(highlight_id, request_id)
);

-- Only fields already displayed publicly are included. AI remains private.
UPDATE chapter_highlights SET publication = jsonb_build_object(
  'note', note, 'materials', '[]'::jsonb, 'published_at', created_at
) WHERE is_public AND publication IS NULL;

-- Each legacy result gets a deterministic request ID, making reruns harmless.
INSERT INTO highlight_materials(highlight_id, kind, origin, content, legacy_image_url, request_id)
SELECT h.id, CASE WHEN a.key = 'illustrate' THEN 'image' ELSE a.key END,
  'ai', COALESCE(a.value->>'content', ''), a.value->>'image_url',
  md5(h.id::text || ':' || a.key)::uuid
FROM chapter_highlights h CROSS JOIN LATERAL jsonb_each(h.ai_artifacts) a
WHERE a.key IN ('explain','meaning','illustrate')
ON CONFLICT (highlight_id, request_id) DO NOTHING;
INSERT INTO highlight_materials(highlight_id, kind, origin, content, request_id)
SELECT h.id, 'rewrite', 'ai', COALESCE(a.value->>'content', ''), md5(h.id::text || ':rewrite:' || a.key)::uuid
FROM chapter_highlights h CROSS JOIN LATERAL jsonb_each(COALESCE(h.ai_artifacts->'rewrite', '{}'::jsonb)) a
ON CONFLICT (highlight_id, request_id) DO NOTHING;
COMMIT;
