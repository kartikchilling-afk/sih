/*
# MediKiosk - Complete Patient Portal Schema

## Overview
Creates the full database backend for MediKiosk, a patient-facing clinical intake kiosk.
Single-tenant (no auth) schema: the app runs as the anon role and all data is shared/public.

## New Tables

1. **patients** - Patient profile information
   - id (uuid PK), name, age, gender, phone, email, address, blood_group, patient_code, avatar_initials, created_at, updated_at

2. **health_stories** - Patient's guided intake sessions
   - id (uuid PK), patient_id (FK), chief_concern, history_of_present_illness, past_history, drug_allergy, personal_history, ayush_mode (bool), prior_surgery (bool), has_red_flag (bool), red_flag_note, status (enum: draft/complete/flagged), language, created_at, updated_at

3. **documents** - Uploaded medical documents (prescriptions, reports, scans)
   - id (uuid PK), patient_id (FK), health_story_id (FK nullable), filename, file_type, file_size, category (enum: prescription/lab_report/scan/discharge_summary/other), ocr_status (enum: pending/processed/failed), ocr_extracted_text, created_at

4. **consent_records** - Patient consent for data processing and sharing
   - id (uuid PK), patient_id (FK), consent_type (enum: data_processing/document_upload/abha_linkage/history_sharing), granted (bool), granted_at, revoked_at, notes

5. **activity_log** - Recent activity records shown in "Your health records" section
   - id (uuid PK), patient_id (FK), activity_type (enum: health_story_started/document_uploaded/consultation_completed/consent_given/consent_revoked/profile_updated), title, description, status (enum: in_progress/complete/flagged), metadata (jsonb), created_at

6. **abha_records** - ABHA (Ayushman Bharat Health Account) linkage status
   - id (uuid PK), patient_id (FK), abha_number, linkage_status (enum: pending/linked/failed), linked_at

## Security
- RLS enabled on ALL tables.
- All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because this is a single-tenant no-auth app where data is intentionally shared.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
*/

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Aarav Sharma',
  age int NOT NULL DEFAULT 34,
  gender text NOT NULL DEFAULT 'Male',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  blood_group text DEFAULT '',
  patient_code text NOT NULL DEFAULT 'MK-28491',
  avatar_initials text NOT NULL DEFAULT 'AS',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_patients" ON patients;
CREATE POLICY "anon_select_patients" ON patients FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_patients" ON patients;
CREATE POLICY "anon_insert_patients" ON patients FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_patients" ON patients;
CREATE POLICY "anon_update_patients" ON patients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_patients" ON patients;
CREATE POLICY "anon_delete_patients" ON patients FOR DELETE TO anon, authenticated USING (true);

-- Health stories table
CREATE TABLE IF NOT EXISTS health_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  chief_concern text DEFAULT '',
  history_of_present_illness text DEFAULT '',
  past_history text DEFAULT '',
  drug_allergy text DEFAULT '',
  personal_history text DEFAULT '',
  ayush_mode boolean DEFAULT false,
  prior_surgery boolean DEFAULT false,
  has_red_flag boolean DEFAULT false,
  red_flag_note text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  language text NOT NULL DEFAULT 'English',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE health_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_health_stories" ON health_stories;
CREATE POLICY "anon_select_health_stories" ON health_stories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_health_stories" ON health_stories;
CREATE POLICY "anon_insert_health_stories" ON health_stories FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_health_stories" ON health_stories;
CREATE POLICY "anon_update_health_stories" ON health_stories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_health_stories" ON health_stories;
CREATE POLICY "anon_delete_health_stories" ON health_stories FOR DELETE TO anon, authenticated USING (true);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  health_story_id uuid REFERENCES health_stories(id) ON DELETE SET NULL,
  filename text NOT NULL,
  file_type text DEFAULT 'pdf',
  file_size int DEFAULT 0,
  category text NOT NULL DEFAULT 'other',
  ocr_status text NOT NULL DEFAULT 'pending',
  ocr_extracted_text text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO anon, authenticated USING (true);

-- Consent records table
CREATE TABLE IF NOT EXISTS consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_consent_records" ON consent_records;
CREATE POLICY "anon_select_consent_records" ON consent_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_consent_records" ON consent_records;
CREATE POLICY "anon_insert_consent_records" ON consent_records FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_consent_records" ON consent_records;
CREATE POLICY "anon_update_consent_records" ON consent_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_consent_records" ON consent_records;
CREATE POLICY "anon_delete_consent_records" ON consent_records FOR DELETE TO anon, authenticated USING (true);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'complete',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activity_log" ON activity_log;
CREATE POLICY "anon_select_activity_log" ON activity_log FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_activity_log" ON activity_log;
CREATE POLICY "anon_insert_activity_log" ON activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_activity_log" ON activity_log;
CREATE POLICY "anon_update_activity_log" ON activity_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_activity_log" ON activity_log;
CREATE POLICY "anon_delete_activity_log" ON activity_log FOR DELETE TO anon, authenticated USING (true);

-- ABHA records table
CREATE TABLE IF NOT EXISTS abha_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  abha_number text DEFAULT '',
  linkage_status text NOT NULL DEFAULT 'pending',
  linked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE abha_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_abha_records" ON abha_records;
CREATE POLICY "anon_select_abha_records" ON abha_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_abha_records" ON abha_records;
CREATE POLICY "anon_insert_abha_records" ON abha_records FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_abha_records" ON abha_records;
CREATE POLICY "anon_update_abha_records" ON abha_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_abha_records" ON abha_records;
CREATE POLICY "anon_delete_abha_records" ON abha_records FOR DELETE TO anon, authenticated USING (true);

-- Seed default patient
INSERT INTO patients (name, age, gender, phone, email, address, blood_group, patient_code, avatar_initials)
SELECT 'Aarav Sharma', 34, 'Male', '+91 98765 43210', 'aarav.sharma@email.com', 'Pune, Maharashtra', 'B+', 'MK-28491', 'AS'
WHERE NOT EXISTS (SELECT 1 FROM patients LIMIT 1);

-- Seed initial activity
INSERT INTO activity_log (patient_id, activity_type, title, description, status)
SELECT p.id, 'health_story_started', 'Health story started', 'Today, 10:24 AM · In progress', 'in_progress'
FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM activity_log LIMIT 1);

INSERT INTO activity_log (patient_id, activity_type, title, description, status)
SELECT p.id, 'consultation_completed', 'Previous consultation summary', '12 July 2026 · City Care Hospital', 'complete'
FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE activity_type = 'consultation_completed');

-- Seed default consent records
INSERT INTO consent_records (patient_id, consent_type, granted, notes)
SELECT p.id, 'data_processing', false, 'Pending patient consent'
FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM consent_records WHERE consent_type = 'data_processing');

INSERT INTO consent_records (patient_id, consent_type, granted, notes)
SELECT p.id, 'document_upload', false, 'Pending patient consent'
FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM consent_records WHERE consent_type = 'document_upload');

INSERT INTO consent_records (patient_id, consent_type, granted, notes)
SELECT p.id, 'abha_linkage', false, 'Pending patient consent'
FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM consent_records WHERE consent_type = 'abha_linkage');

INSERT INTO consent_records (patient_id, consent_type, granted, notes)
SELECT p.id, 'history_sharing', false, 'Pending patient consent'
FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM consent_records WHERE consent_type = 'history_sharing');

-- Seed ABHA record
INSERT INTO abha_records (patient_id, abha_number, linkage_status)
SELECT p.id, '', 'pending'
FROM patients p
WHERE NOT EXISTS (SELECT 1 FROM abha_records LIMIT 1);
