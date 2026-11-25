-- Persist Claude-generated newsroom drafts for editor review.
ALTER TABLE public.tony_newsroom_items
  ADD COLUMN IF NOT EXISTS ai_draft jsonb,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS ai_generation_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tony_newsroom_items_ai_generation_status_check'
      AND conrelid = 'public.tony_newsroom_items'::regclass
  ) THEN
    ALTER TABLE public.tony_newsroom_items
      ADD CONSTRAINT tony_newsroom_items_ai_generation_status_check
      CHECK (ai_generation_status IN ('pending','generated','failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tony_newsroom_ai_pending_idx
  ON public.tony_newsroom_items (score DESC, source_published_at DESC)
  WHERE ai_draft IS NULL AND editorial_status = 'new' AND ai_generation_status IN ('pending','failed');
