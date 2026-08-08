-- ============================================================
-- Service Registration feature — run this in Supabase SQL Editor
-- (Supabase dashboard → SQL Editor → paste → Run)
-- ============================================================
-- Adds the service_registrations table (API-key issuance for the
-- universal SDK) + service_id on knowledge_nodes (row attribution).
-- Idempotent: safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS service_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  version text NOT NULL DEFAULT '1.0.0',
  owner_email text NOT NULL,
  description text,
  domain text NOT NULL DEFAULT 'general',
  knowledge_types jsonb NOT NULL DEFAULT '[]',
  rate_limit integer NOT NULL DEFAULT 60,
  api_key_prefix text NOT NULL,
  api_key_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Row-level security: by default only the owner (postgres/anon role) can
-- read/write. The API server connects as the service role, so this table
-- must be accessible to it. If your project uses RLS, enable it later per
-- your access model — for now keep it simple and consistent with the rest
-- of the schema (other tables in this project are non-RLS by default).

ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS service_id text;

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_service_id ON knowledge_nodes (service_id);

-- ============================================================
-- Verify (expected output):
--   service_registrations table exists → ✅
--   knowledge_nodes.service_id column → ✅
-- ============================================================
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'service_registrations') AS service_table_ok,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'knowledge_nodes' AND column_name = 'service_id') AS service_col_ok;
