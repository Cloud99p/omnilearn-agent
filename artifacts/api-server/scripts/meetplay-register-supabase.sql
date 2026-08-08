-- MeetPlay service registration for PRODUCTION (Supabase).
-- Run in Supabase dashboard -> SQL Editor after the DDL.
-- Idempotent: upserts by name.
INSERT INTO service_registrations (name, version, owner_email, description, domain, knowledge_types, rate_limit, api_key_prefix, api_key_hash, status)
VALUES (
  'meetplay',
  '1.0.0',
  'emmanuelhosea09@gmail.com',
  'MeetPlay meeting intelligence (captions -> graph, Who Said That?, recap)',
  'general',
  '["utterance","meeting","question"]'::jsonb,
  60,
  'oml_205ed872',
  'ca1397f3a1cc75cd0a811f68d6fe1075f7183ba884ae337836f54d5c04e7a3f9',
  'active'
)
ON CONFLICT (name) DO UPDATE SET
  api_key_hash = EXCLUDED.api_key_hash,
  api_key_prefix = EXCLUDED.api_key_prefix,
  status = 'active',
  updated_at = now();

-- Verify
SELECT name, status, api_key_prefix, left(api_key_hash, 12) AS hash_prefix FROM service_registrations WHERE name = 'meetplay';
