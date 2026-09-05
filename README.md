# sih

## Supabase setup

Apply both SQL files in `supabase/migrations/` in the Supabase SQL Editor, then add these repository secrets under **Settings -> Secrets and variables -> Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The GitHub Pages workflow stops before deployment when either secret is missing, so a disconnected backend cannot be published silently.
