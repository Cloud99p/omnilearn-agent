/**
 * One-off DDL for the service registration feature.
 * Applied directly because drizzle-kit's TS loader fails to resolve
 * NodeNext `.js` specifiers on Windows (see drizzle.push.config attempt).
 * The canonical schema lives in lib/db/src/schema/*.ts — this must stay in
 * sync with service-registrations.ts + knowledge-nodes.ts (service_id).
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

const DDL = `
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

ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS service_id text;

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_service_id ON knowledge_nodes (service_id);
`;

async function main() {
  await client.connect();
  await client.query(DDL);
  // Verify
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'service_registrations'`
  );
  const col = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_nodes' AND column_name = 'service_id'`
  );
  console.log(
    `service_registrations table: ${tables.rows.length === 1 ? "✅ created" : "❌ missing"}`
  );
  console.log(`knowledge_nodes.service_id: ${col.rows.length === 1 ? "✅ added" : "❌ missing"}`);
  await client.end();
  process.exit(tables.rows.length === 1 && col.rows.length === 1 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
