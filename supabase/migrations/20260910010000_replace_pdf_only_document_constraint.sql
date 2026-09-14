-- This corrective migration is required for databases where the original
-- PDF-only constraint has already been applied.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_pdf_only;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_supported_file_types;
ALTER TABLE documents
  ADD CONSTRAINT documents_supported_file_types
  CHECK (lower(file_type) IN ('pdf', 'png', 'jpg'));
