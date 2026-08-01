-- Stability hardening for chapter highlights and editorial notes.

ALTER TABLE public.chapter_highlights
  ADD COLUMN IF NOT EXISTS client_request_id UUID,
  ADD COLUMN IF NOT EXISTS start_offset INTEGER,
  ADD COLUMN IF NOT EXISTS end_offset INTEGER,
  ADD COLUMN IF NOT EXISTS source_chapter_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.chapter_editorial_notes
  ADD COLUMN IF NOT EXISTS client_request_id UUID,
  ADD COLUMN IF NOT EXISTS start_offset INTEGER,
  ADD COLUMN IF NOT EXISTS end_offset INTEGER,
  ADD COLUMN IF NOT EXISTS source_chapter_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_highlights_request
  ON public.chapter_highlights(user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_notes_request
  ON public.chapter_editorial_notes(author_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_chapter_highlights_updated_at ON public.chapter_highlights;
CREATE TRIGGER update_chapter_highlights_updated_at
  BEFORE UPDATE ON public.chapter_highlights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_editorial_notes_updated_at ON public.chapter_editorial_notes;
CREATE TRIGGER update_editorial_notes_updated_at
  BEFORE UPDATE ON public.chapter_editorial_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
