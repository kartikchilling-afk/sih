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

## Checks

```sh
npm run typecheck
npm run lint
npm run build
```

For GitHub Pages, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings -> Secrets and variables -> Actions**. The deployment should not be published without both values.
