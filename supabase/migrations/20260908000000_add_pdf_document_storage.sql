-- Store medical document attachments and keep a reference to each object in documents.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_pdf_only;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_supported_file_types;
ALTER TABLE documents ADD CONSTRAINT documents_supported_file_types CHECK (lower(file_type) IN ('pdf', 'png', 'jpg')) NOT VALID;

INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-documents', 'medical-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_medical_documents" ON storage.objects;
CREATE POLICY "anon_upload_medical_documents" ON storage.objects FOR INSERT
TO anon, authenticated WITH CHECK (
  bucket_id = 'medical-documents'
  AND lower(name) ~ '\.(pdf|png|jpe?g)$'
  AND coalesce((metadata->>'mimetype'), '') IN ('application/pdf', 'image/png', 'image/jpeg')
);

DROP POLICY IF EXISTS "anon_read_medical_documents" ON storage.objects;
CREATE POLICY "anon_read_medical_documents" ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'medical-documents');

DROP POLICY IF EXISTS "anon_delete_medical_documents" ON storage.objects;
CREATE POLICY "anon_delete_medical_documents" ON storage.objects FOR DELETE
TO anon, authenticated USING (bucket_id = 'medical-documents');
