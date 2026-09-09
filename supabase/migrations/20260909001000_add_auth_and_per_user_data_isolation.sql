-- Give every patient profile an authenticated owner. Existing pre-auth demo rows
-- remain unassigned and are no longer exposed through the application.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS patients_user_id_unique ON patients (user_id) WHERE user_id IS NOT NULL;

-- Remove the original shared-data policies.
DO $$
DECLARE
  target_table text;
  policy_record record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['patients', 'health_stories', 'documents', 'consent_records', 'activity_log', 'abha_records', 'health_reports', 'document_processing_jobs', 'document_intelligence_results']
  LOOP
    FOR policy_record IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "users_manage_own_patient" ON patients FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Every record below is visible and writable only when its patient profile is
-- owned by the authenticated user.
CREATE POLICY "users_manage_own_health_stories" ON health_stories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = health_stories.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = health_stories.patient_id AND patients.user_id = auth.uid()));
CREATE POLICY "users_manage_own_documents" ON documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = documents.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = documents.patient_id AND patients.user_id = auth.uid()));
CREATE POLICY "users_manage_own_consents" ON consent_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = consent_records.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = consent_records.patient_id AND patients.user_id = auth.uid()));
CREATE POLICY "users_manage_own_activity" ON activity_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = activity_log.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = activity_log.patient_id AND patients.user_id = auth.uid()));
CREATE POLICY "users_manage_own_abha" ON abha_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = abha_records.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = abha_records.patient_id AND patients.user_id = auth.uid()));
CREATE POLICY "users_manage_own_reports" ON health_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = health_reports.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = health_reports.patient_id AND patients.user_id = auth.uid()));
CREATE POLICY "users_manage_own_processing_jobs" ON document_processing_jobs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = document_processing_jobs.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = document_processing_jobs.patient_id AND patients.user_id = auth.uid()));
CREATE POLICY "users_manage_own_document_results" ON document_intelligence_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = document_intelligence_results.patient_id AND patients.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM patients WHERE patients.id = document_intelligence_results.patient_id AND patients.user_id = auth.uid()));

-- File objects use the auth user ID as their top-level folder, matching the
-- storage path created by the client.
DROP POLICY IF EXISTS "anon_upload_medical_documents" ON storage.objects;
DROP POLICY IF EXISTS "anon_read_medical_documents" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_medical_documents" ON storage.objects;
CREATE POLICY "users_manage_own_medical_documents" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'medical-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'medical-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
