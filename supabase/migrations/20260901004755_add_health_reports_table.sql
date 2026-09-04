/*
# MediKiosk - Add health_reports table

## Overview
Adds a health_reports table that stores generated health reports after a patient
completes their intake health story. Each report is linked to a health_story and
contains a structured clinical summary the physician can review.

## New Table
- **health_reports**
  - id (uuid PK)
  - patient_id (FK -> patients, CASCADE)
  - health_story_id (FK -> health_stories, SET NULL)
  - report_title (text) - e.g. "Health Report - 01 Sep 2026"
  - chief_concern (text)
  - hpi (text) - history of present illness
  - past_history (text)
  - drug_allergy (text)
  - personal_history (text)
  - ayush_mode (boolean)
  - prior_surgery (boolean)
  - has_red_flag (boolean)
  - red_flag_note (text)
  - physician_notes (text, default '') - notes added during/after consultation
  - diagnosis (text, default '')
  - prescription (text, default '')
  - advice (text, default '')
  - follow_up (text, default '')
  - status (text, default 'generated') - generated / reviewed / completed
  - language (text, default 'English')
  - created_at (timestamptz)
  - updated_at (timestamptz)

## Security
- RLS enabled.
- 4 policies (SELECT/INSERT/UPDATE/DELETE) for anon + authenticated (single-tenant).
*/

CREATE TABLE IF NOT EXISTS health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  health_story_id uuid REFERENCES health_stories(id) ON DELETE SET NULL,
  report_title text NOT NULL DEFAULT 'Health Report',
  chief_concern text DEFAULT '',
  hpi text DEFAULT '',
  past_history text DEFAULT '',
  drug_allergy text DEFAULT '',
  personal_history text DEFAULT '',
  ayush_mode boolean DEFAULT false,
  prior_surgery boolean DEFAULT false,
  has_red_flag boolean DEFAULT false,
  red_flag_note text DEFAULT '',
  physician_notes text DEFAULT '',
  diagnosis text DEFAULT '',
  prescription text DEFAULT '',
  advice text DEFAULT '',
  follow_up text DEFAULT '',
  status text NOT NULL DEFAULT 'generated',
  language text DEFAULT 'English',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE health_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_health_reports" ON health_reports;
CREATE POLICY "anon_select_health_reports" ON health_reports FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_health_reports" ON health_reports;
CREATE POLICY "anon_insert_health_reports" ON health_reports FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_health_reports" ON health_reports;
CREATE POLICY "anon_update_health_reports" ON health_reports FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_health_reports" ON health_reports;
CREATE POLICY "anon_delete_health_reports" ON health_reports FOR DELETE
TO anon, authenticated USING (true);
