-- Backend work queue for the OCR/document-intelligence worker.
CREATE TABLE IF NOT EXISTS document_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_processing_jobs_status_created_at_idx
  ON document_processing_jobs (status, created_at);

ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_document_processing_jobs" ON document_processing_jobs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_document_processing_jobs" ON document_processing_jobs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_document_processing_jobs" ON document_processing_jobs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION enqueue_document_processing_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO document_processing_jobs (document_id, patient_id) VALUES (NEW.id, NEW.patient_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_enqueue_processing ON documents;
CREATE TRIGGER documents_enqueue_processing
AFTER INSERT ON documents FOR EACH ROW EXECUTE FUNCTION enqueue_document_processing_job();
