ALTER TABLE public.chapter_edit_leases
  ADD COLUMN document_id text;

ALTER TABLE public.chapter_edit_leases
  ADD CONSTRAINT chapter_edit_leases_document_id_check
  CHECK (document_id IS NULL OR (char_length(document_id) >= 8 AND char_length(document_id) <= 128));
