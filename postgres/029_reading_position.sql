-- Text anchors survive font changes, resizing and switching between devices.
ALTER TABLE public.reading_progress
  ADD COLUMN IF NOT EXISTS position JSONB;

ALTER TABLE public.reading_progress
  ADD CONSTRAINT reading_progress_position_object
  CHECK (position IS NULL OR jsonb_typeof(position) = 'object');
