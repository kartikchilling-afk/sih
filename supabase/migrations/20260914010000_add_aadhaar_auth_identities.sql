-- Stores only a keyed hash of a provider-issued verified identity reference.
-- Raw Aadhaar numbers and OTPs must never be persisted.
CREATE TABLE IF NOT EXISTS aadhaar_auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE aadhaar_auth_identities ENABLE ROW LEVEL SECURITY;

-- There are deliberately no client policies. Only the server-side auth function,
-- running with the service role, may read or write this identity mapping.
