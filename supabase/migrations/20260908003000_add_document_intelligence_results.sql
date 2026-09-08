CREATE TABLE IF NOT EXISTS document_intelligence_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  diagnoses jsonb NOT NULL DEFAULT '[]'::jsonb,
  medications jsonb NOT NULL DEFAULT '[]'::jsonb,
  investigations jsonb NOT NULL DEFAULT '[]'::jsonb,
  procedures jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_intelligence_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_document_intelligence_results" ON document_intelligence_results FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_insert_document_intelligence_results" ON document_intelligence_results FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "service_update_document_intelligence_results" ON document_intelligence_results FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
