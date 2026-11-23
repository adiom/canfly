ALTER TABLE public.chapters ADD COLUMN revision integer NOT NULL DEFAULT 0;

CREATE FUNCTION public.advance_chapter_revision() RETURNS trigger
LANGUAGE plpgsql
AS $chapter_revision$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.revision := OLD.revision + 1;
  END IF;
  RETURN NEW;
END;
$chapter_revision$;

CREATE TRIGGER advance_chapter_revision
BEFORE UPDATE OF title, content, word_count, status, chapter_index, published_at,
  audio_url, audio_blob_path, duration_seconds, audio_metadata, audio_content_type,
  audio_file_size_bytes, audio_uploaded_at
ON public.chapters
FOR EACH ROW EXECUTE FUNCTION public.advance_chapter_revision();
