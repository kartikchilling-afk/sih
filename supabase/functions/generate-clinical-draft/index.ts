import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reviewSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patient_summary: { type: 'string' },
    pdf_findings: { type: 'array', items: { type: 'string' } },
    urgent_flags: { type: 'array', items: { type: 'string' } },
    clinician_questions: { type: 'array', items: { type: 'string' } },
    medication_considerations: { type: 'array', items: { type: 'string' } },
    safety_note: { type: 'string' },
  },
  required: ['patient_summary', 'pdf_findings', 'urgent_flags', 'clinician_questions', 'medication_considerations', 'safety_note'],
};

function responseText(response: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  if (response.output_text) return response.output_text;
  return response.output?.flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text || '')
    .join('') || '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return Response.json({ error: 'Authentication is required' }, { status: 401, headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Authentication is required' }, { status: 401, headers: corsHeaders });

  const { reportId } = await request.json();
  if (!reportId) return Response.json({ error: 'reportId is required' }, { status: 400, headers: corsHeaders });

  const supabase = createClient(url, serviceKey);
  const { data: report, error: reportError } = await supabase.from('health_reports').select('*').eq('id', reportId).single();
  if (reportError || !report) return Response.json({ error: 'Report not found' }, { status: 404, headers: corsHeaders });

  const { data: patient } = await supabase.from('patients').select('id').eq('id', report.patient_id).eq('user_id', user.id).maybeSingle();
  if (!patient) return Response.json({ error: 'You do not have access to this report' }, { status: 403, headers: corsHeaders });

  const [{ data: documents }, { data: intelligence }] = await Promise.all([
    supabase.from('documents').select('id, filename, file_type, ocr_status, ocr_extracted_text').eq('patient_id', report.patient_id).eq('ocr_status', 'processed'),
    supabase.from('document_intelligence_results').select('document_id, summary, diagnoses, medications, investigations, procedures').eq('patient_id', report.patient_id),
  ]);
  const processedDocuments = documents || [];
  if (!processedDocuments.length) return Response.json({ error: 'No processed PDF or image documents are available yet. Upload a document and wait for digitisation to finish.' }, { status: 400, headers: corsHeaders });

  const findingsByDocument = new Map((intelligence || []).map((item) => [item.document_id, item]));
  const documentContext = processedDocuments.map((document) => {
    const findings = findingsByDocument.get(document.id);
    return {
      filename: document.filename,
      file_type: document.file_type,
      extracted_text: (document.ocr_extracted_text || '').slice(0, 12000),
      structured_findings: findings || null,
    };
  });

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const model = Deno.env.get('OPENAI_MODEL');
  if (!apiKey || !model) return Response.json({ error: 'AI review is not configured. Set OPENAI_API_KEY and OPENAI_MODEL as Supabase secrets.' }, { status: 503, headers: corsHeaders });

  const input = JSON.stringify({
    report: {
      chief_concern: report.chief_concern,
      hpi: report.hpi,
      past_history: report.past_history,
      drug_allergy: report.drug_allergy,
      personal_history: report.personal_history,
      family_history: report.family_history,
      review_of_systems: report.review_of_systems,
      red_flag_note: report.red_flag_note,
      language: report.language,
    },
    documents: documentContext,
  });

  const aiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1400,
      instructions: `You are a clinical document-review assistant for a licensed clinician. Use only the supplied patient report and digitised document text. Create a concise, factual review draft in the report language. Never diagnose, prescribe, select a drug, recommend a dose, or tell a patient to start, stop, or change treatment. medication_considerations may only identify medication names already present in source documents and must say “clinician to verify”. Flag possible emergencies or missing information for immediate clinician review. If a fact is not in the source, say it is not documented. This output is a draft for clinician review, not medical advice.`,
      input,
      text: { format: { type: 'json_schema', name: 'clinical_document_review', strict: true, schema: reviewSchema } },
    }),
  });
  if (!aiResponse.ok) return Response.json({ error: `AI review service returned ${aiResponse.status}` }, { status: 502, headers: corsHeaders });

  const payload = await aiResponse.json();
  let generated;
  try {
    generated = JSON.parse(responseText(payload));
  } catch {
    return Response.json({ error: 'AI review returned an invalid structured response' }, { status: 502, headers: corsHeaders });
  }

  const review = {
    ...generated,
    source_document_count: processedDocuments.length,
    generated_at: new Date().toISOString(),
  };
  const { error: saveError } = await supabase.from('health_reports').update({ ai_review: review }).eq('id', reportId);
  if (saveError) return Response.json({ error: 'Could not save AI review' }, { status: 500, headers: corsHeaders });
  return Response.json({ review }, { headers: corsHeaders });
});
