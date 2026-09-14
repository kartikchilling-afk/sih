import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: corsHeaders });

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function providerUrl(path: string) {
  const baseUrl = Deno.env.get('AADHAAR_OTP_PROVIDER_URL');
  if (!baseUrl) throw new Error('Aadhaar OTP provider is not configured.');
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

async function callProvider(path: string, body: Record<string, string>) {
  const apiKey = Deno.env.get('AADHAAR_OTP_PROVIDER_API_KEY');
  const response = await fetch(providerUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'The Aadhaar provider could not complete this request.');
  return result as Record<string, unknown>;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { action, aadhaarNumber, requestId, otp } = await request.json();
    const identitySecret = Deno.env.get('AADHAAR_IDENTITY_HMAC_KEY');
    if (!identitySecret) return json({ error: 'Aadhaar identity protection is not configured.' }, 503);

    if (action === 'requestOtp') {
      if (typeof aadhaarNumber !== 'string' || !/^\d{12}$/.test(aadhaarNumber)) return json({ error: 'Enter a valid 12-digit Aadhaar number.' }, 400);
      // Provider endpoints are intentionally server-side. Configure this adapter
      // to match the contract supplied by an authorized AUA/KUA provider.
      const result = await callProvider('otp/request', { aadhaarNumber });
      const providerRequestId = result.requestId ?? result.transactionId;
      if (typeof providerRequestId !== 'string') throw new Error('The Aadhaar provider did not return an OTP request ID.');
      return json({ requestId: providerRequestId });
    }

    if (action === 'verifyOtp') {
      if (typeof requestId !== 'string' || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return json({ error: 'A valid OTP request and 6-digit OTP are required.' }, 400);
      const result = await callProvider('otp/verify', { requestId, otp });
      // The provider must return a stable opaque identity reference only after
      // successful OTP verification. Do not use the raw Aadhaar number here.
      const providerIdentity = result.identityReference ?? result.verifiedIdentityId;
      if (result.verified !== true || typeof providerIdentity !== 'string') return json({ error: 'OTP verification was not successful.' }, 401);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const identityHash = await hmac(providerIdentity, identitySecret);
      const authPassword = await hmac(`session:${providerIdentity}`, identitySecret);
      const internalEmail = `aadhaar-${identityHash}@identity.medikiosk.internal`;
      const { data: identity } = await admin.from('aadhaar_auth_identities').select('user_id').eq('identity_hash', identityHash).maybeSingle();

      let userId = identity?.user_id as string | undefined;
      if (!userId) {
        const { data: created, error: createError } = await admin.auth.admin.createUser({ email: internalEmail, password: authPassword, email_confirm: true });
        if (createError || !created.user) throw new Error(createError?.message || 'Could not create the secure patient account.');
        userId = created.user.id;
        const { error: identityError } = await admin.from('aadhaar_auth_identities').insert({ identity_hash: identityHash, user_id: userId });
        if (identityError) throw new Error('Could not securely link the verified identity.');
      }

      const auth = createClient(supabaseUrl, serviceRoleKey);
      const { data: sessionData, error: sessionError } = await auth.auth.signInWithPassword({ email: internalEmail, password: authPassword });
      if (sessionError || !sessionData.session) throw new Error(sessionError?.message || 'Could not create a secure session.');
      return json({ session: sessionData.session });
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Aadhaar authentication could not be completed.';
    return json({ error: message }, 500);
  }
});
