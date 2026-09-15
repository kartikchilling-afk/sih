-- Stores an AI-generated clinical-review draft. It is deliberately separate
-- from clinician-authored diagnosis and prescription fields.
ALTER TABLE health_reports
  ADD COLUMN IF NOT EXISTS ai_review jsonb NOT NULL DEFAULT '{}'::jsonb;
