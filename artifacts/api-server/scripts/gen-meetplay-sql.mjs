import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Read the meetplay key from its .env
const env = readFileSync("C:/Users/jpout/.openclaw/workspace/meetplay/.env", "utf8");
const m = env.match(/^OMNILEARN_API_KEY=(.+)$/m);
if (!m) {
  console.error("key not found");
  process.exit(1);
}
const key = m[1].trim();
const hash = createHash("sha256").update(key).digest("hex");
const prefix = "oml_" + key.slice(4, 12);

const sql = `-- MeetPlay service registration for PRODUCTION (Supabase).
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
  '${prefix}',
  '${hash}',
  'active'
)
ON CONFLICT (name) DO UPDATE SET
  api_key_hash = EXCLUDED.api_key_hash,
  api_key_prefix = EXCLUDED.api_key_prefix,
  status = 'active',
  updated_at = now();

-- Verify
SELECT name, status, api_key_prefix, left(api_key_hash, 12) AS hash_prefix FROM service_registrations WHERE name = 'meetplay';
`;

writeFileSync("C:/Users/jpout/.openclaw/workspace/omnilearn-agent/artifacts/api-server/scripts/meetplay-register-supabase.sql", sql, "utf8");
console.log("✅ generated meetplay-register-supabase.sql");
console.log("prefix:", prefix);
console.log("hash:", hash.slice(0, 16) + "...");
console.log("key length:", key.length);
