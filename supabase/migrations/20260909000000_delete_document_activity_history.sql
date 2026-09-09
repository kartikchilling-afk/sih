-- Keep document-specific history in sync with document deletion.
-- OCR results and processing jobs already reference documents with ON DELETE CASCADE.

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS activity_log_document_id_idx ON activity_log (document_id);

CREATE OR REPLACE FUNCTION delete_document_activity_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM activity_log
  WHERE patient_id = OLD.patient_id
    AND (
      document_id = OLD.id
      OR metadata ->> 'document_id' = OLD.id::text
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS documents_delete_activity_history ON documents;
CREATE TRIGGER documents_delete_activity_history
  BEFORE DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION delete_document_activity_history();
