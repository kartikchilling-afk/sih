import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Patient = {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  address: string;
  blood_group: string;
  patient_code: string;
  avatar_initials: string;
  created_at: string;
  updated_at: string;
};

export type HealthStory = {
  id: string;
  patient_id: string;
  chief_concern: string;
  history_of_present_illness: string;
  past_history: string;
  drug_allergy: string;
  personal_history: string;
  ayush_mode: boolean;
  prior_surgery: boolean;
  has_red_flag: boolean;
  red_flag_note: string;
  status: string;
  language: string;
  created_at: string;
  updated_at: string;
};

export type MedicalDocument = {
  id: string;
  patient_id: string;
  health_story_id: string | null;
  filename: string;
  file_type: string;
  file_size: number;
  category: string;
  ocr_status: string;
  ocr_extracted_text: string;
  created_at: string;
};

export type ConsentRecord = {
  id: string;
  patient_id: string;
  consent_type: string;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  notes: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  patient_id: string;
  activity_type: string;
  title: string;
  description: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AbhaRecord = {
  id: string;
  patient_id: string;
  abha_number: string;
  linkage_status: string;
  linked_at: string | null;
  created_at: string;
};

export type HealthReport = {
  id: string;
  patient_id: string;
  health_story_id: string | null;
  report_title: string;
  chief_concern: string;
  hpi: string;
  past_history: string;
  drug_allergy: string;
  personal_history: string;
  ayush_mode: boolean;
  prior_surgery: boolean;
  has_red_flag: boolean;
  red_flag_note: string;
  physician_notes: string;
  diagnosis: string;
  prescription: string;
  advice: string;
  follow_up: string;
  status: string;
  language: string;
  created_at: string;
  updated_at: string;
};
