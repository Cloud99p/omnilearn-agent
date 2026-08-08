import { readFileSync } from "node:fs";
import pg from "pg";

// Read connection pieces from the gitignored .env.supabase (masked password)
const raw = readFileSync("C:/Users/jpout/.openclaw/workspace/omnilearn-agent/.env.supabase", "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  .slice("DATABASE_URL=".length)
  .trim();

const m = raw.match(/^postgresql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)$/);
if (!m) throw new Error("cannot parse");
const [, user, pass, host, port, db] = m;

const c = new pg.Client({
  connectionString: `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${db}`,
  connectionTimeoutMillis: 15000,
  family: 4,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
console.log("✅ connected to Supabase:", db);

// Step 1: DDL
const ddl = readFileSync("C:/Users/jpout/.openclaw/workspace/omnilearn-agent/artifacts/api-server/scripts/service-ddl-supabase.sql", "utf8");
await c.query(ddl);
console.log("✅ DDL applied");

// Verify DDL
const v = await c.query(
  `SELECT
    (SELECT count(*) FROM information_schema.tables WHERE table_name = 'service_registrations') AS service_table_ok,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = 'knowledge_nodes' AND column_name = 'service_id') AS service_col_ok`
);
console.log("verify:", JSON.stringify(v.rows[0]));

// Step 2: register meetplay
const reg = readFileSync("C:/Users/jpout/.openclaw/workspace/omnilearn-agent/artifacts/api-server/scripts/meetplay-register-supabase.sql", "utf8");
await c.query(reg);
console.log("✅ meetplay registered");

const r = await c.query("SELECT name, status, api_key_prefix, left(api_key_hash,12) AS hash_prefix FROM service_registrations WHERE name='meetplay'");
console.log("meetplay row:", JSON.stringify(r.rows[0]));

await c.end();
