import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return btoa(binary);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { documentId } = await request.json();
  if (!documentId) return Response.json({ error: 'documentId is required' }, { status: 400, headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: document, error: documentError } = await supabase.from('documents').select('*').eq('id', documentId).single();
  if (documentError || !document?.storage_path) return Response.json({ error: 'Document was not found' }, { status: 404, headers: corsHeaders });

  const endpoint = Deno.env.get('OCR_SERVICE_URL');
  const key = Deno.env.get('OCR_SERVICE_KEY');
  if (!endpoint) return Response.json({ status: 'queued', detail: 'OCR_SERVICE_URL is not configured' }, { status: 202, headers: corsHeaders });

  await supabase.from('documents').update({ ocr_status: 'processing' }).eq('id', documentId);
  await supabase.from('document_processing_jobs').update({ status: 'processing', attempts: 1, updated_at: new Date().toISOString() }).eq('document_id', documentId);
  try {
    const { data: file, error: downloadError } = await supabase.storage.from('medical-documents').download(document.storage_path);
    if (downloadError || !file) throw new Error(downloadError?.message || 'Unable to download document');
    const mimeType = document.file_type === 'pdf' ? 'application/pdf' : document.file_type === 'png' ? 'image/png' : 'image/jpeg';
    const body = { documentId, patientId: document.patient_id, fileName: document.filename, mimeType, documentBase64: toBase64(new Uint8Array(await file.arrayBuffer())) };
    const ocrResponse = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) });
    if (!ocrResponse.ok) throw new Error(`OCR provider returned ${ocrResponse.status}`);
    const result = await ocrResponse.json();
    await supabase.from('documents').update({ ocr_status: 'processed', ocr_extracted_text: result.text || '' }).eq('id', documentId);
    await supabase.from('document_intelligence_results').upsert({ document_id: documentId, patient_id: document.patient_id, summary: result.summary || '', diagnoses: result.diagnoses || [], medications: result.medications || [], investigations: result.investigations || [], procedures: result.procedures || [], document_date: result.documentDate || null, updated_at: new Date().toISOString() }, { onConflict: 'document_id' });
    await supabase.from('document_processing_jobs').update({ status: 'processed', updated_at: new Date().toISOString() }).eq('document_id', documentId);
    return Response.json({ status: 'processed' }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document processing failed';
    await supabase.from('documents').update({ ocr_status: 'failed' }).eq('id', documentId);
    await supabase.from('document_processing_jobs').update({ status: 'failed', last_error: message, updated_at: new Date().toISOString() }).eq('document_id', documentId);
    return Response.json({ status: 'failed', error: message }, { status: 500, headers: corsHeaders });
  }
});
