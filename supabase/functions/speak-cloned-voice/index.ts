import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const supportedLanguages = new Set(['en', 'hi', 'mr']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  const authorization = request.headers.get('Authorization');
  if (!authorization) return Response.json({ error: 'Authentication is required' }, { status: 401, headers: corsHeaders });

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Authentication is required' }, { status: 401, headers: corsHeaders });

  const { text, language = 'en' } = await request.json().catch(() => ({}));
  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) return Response.json({ error: 'Text is required' }, { status: 400, headers: corsHeaders });
  if (cleanText.length > 2_000) return Response.json({ error: 'Text is too long to speak' }, { status: 400, headers: corsHeaders });
  if (!supportedLanguages.has(language)) return Response.json({ error: 'Unsupported language' }, { status: 400, headers: corsHeaders });

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');
  if (!apiKey || !voiceId) return Response.json({ error: 'Cloned voice is not configured' }, { status: 503, headers: corsHeaders });

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?enable_logging=false&output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: cleanText, model_id: 'eleven_multilingual_v2', language_code: language, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true } }),
  });
  if (!response.ok) {
    console.error('ElevenLabs TTS failed:', response.status);
    return Response.json({ error: 'The cloned voice service could not generate audio' }, { status: 502, headers: corsHeaders });
  }
  return new Response(response.body, { headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
});
