-- Preserve the complete clinician-ready history required for patient case-taking.
ALTER TABLE health_stories ADD COLUMN IF NOT EXISTS family_history text DEFAULT '';
ALTER TABLE health_stories ADD COLUMN IF NOT EXISTS review_of_systems text DEFAULT '';
ALTER TABLE health_stories ADD COLUMN IF NOT EXISTS ayush_assessment text DEFAULT '';

ALTER TABLE health_reports ADD COLUMN IF NOT EXISTS family_history text DEFAULT '';
ALTER TABLE health_reports ADD COLUMN IF NOT EXISTS review_of_systems text DEFAULT '';
ALTER TABLE health_reports ADD COLUMN IF NOT EXISTS ayush_assessment text DEFAULT '';
