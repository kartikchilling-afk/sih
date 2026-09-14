# MediKiosk

MediKiosk is a private patient intake portal backed by Supabase Auth, Postgres, Storage, and an optional document-intelligence Edge Function.

## Local setup

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
3. Install dependencies and start the app:

	```sh
	npm install
	npm run dev
	```

## Supabase setup

Install the Supabase CLI, log in, link the project, and apply every migration in `supabase/migrations/`:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy process-document
```

The migrations create the per-user RLS policies, private `medical-documents` storage bucket, document-processing queue trigger, and report/intelligence tables. The frontend uses anonymous Auth for guest workspaces, so enable **Authentication -> Providers -> Anonymous** in the Supabase dashboard.

Document uploads are stored immediately. To process them, configure the optional OCR provider for the Edge Function:

```sh
supabase secrets set OCR_SERVICE_URL=https://your-ocr-service.example.com/api/ocr OCR_SERVICE_KEY=your-private-key
```

The OCR service receives JSON containing `documentId`, `patientId`, `fileName`, `mimeType`, and base64 document data. It should return `text`, `summary`, `diagnoses`, `medications`, `investigations`, `procedures`, and optionally `documentDate`.

## Aadhaar OTP authentication

The Aadhaar login screen uses the `aadhaar-auth` Edge Function. It must be connected to an authorized Aadhaar AUA/KUA provider before deployment; the browser never sends credentials to the provider directly, and the database never stores raw Aadhaar numbers or OTPs.

Configure these server-side secrets with the provider-specific values, then deploy the function and apply migrations:

```sh
supabase secrets set AADHAAR_OTP_PROVIDER_URL=https://YOUR-AUTHORIZED-PROVIDER/ \
  AADHAAR_OTP_PROVIDER_API_KEY=YOUR_PROVIDER_KEY \
  AADHAAR_IDENTITY_HMAC_KEY=LONG_RANDOM_SERVER_SECRET
supabase db push
supabase functions deploy aadhaar-auth
```

The adapter expects `POST otp/request` to return `requestId` (or `transactionId`), and `POST otp/verify` to return `{ verified: true, identityReference: "stable-provider-reference" }`. Adapt those two calls if your provider uses a different contract. Do not return or persist Aadhaar numbers or OTPs.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
```

For GitHub Pages, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings -> Secrets and variables -> Actions**. The deployment should not be published without both values.
