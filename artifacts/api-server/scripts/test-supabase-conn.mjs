import { readFileSync } from "node:fs";
import pg from "pg";

const REF = "ymcrlwwwgpdyjmcwbtup";

const passCandidates = [
  { label: 'as-is with quotes: @Cloudsupabase1"_"', pass: '@Cloudsupabase1"_"' },
  { label: "without quotes: @Cloudsupabase1", pass: "@Cloudsupabase1" },
  { label: "plain: Cloudsupabase1", pass: "Cloudsupabase1" },
];

const hosts = [
  { label: "direct <ref>.supabase.co :5432", host: `${REF}.supabase.co`, port: 5432 },
  { label: "session pooler :5432", host: "aws-0-eu-west-1.pooler.supabase.com", port: 5432 },
  { label: "transaction pooler :6543", host: "aws-0-eu-west-1.pooler.supabase.com", port: 6543 },
];

for (const p of passCandidates) {
  for (const h of hosts) {
    const url = `postgresql://postgres.${REF}:${encodeURIComponent(p.pass)}@${h.host}:${h.port}/postgres`;
    const masked = `postgresql://postgres.${REF}:***@${h.host}:${h.port}/postgres`;
    try {
      const c = new pg.Client({
        connectionString: url,
        connectionTimeoutMillis: 10000,
        family: 4, // force IPv4 — IPv6 is unreachable on this network
        ssl: { rejectUnauthorized: false },
      });
      await c.connect();
      const r = await c.query("SELECT current_database() AS db, current_user AS usr");
      console.log(`✅ [${p.label}] [${h.label}] -> db=${r.rows[0].db} user=${r.rows[0].usr}`);
      console.log(`   ${masked}`);
      await c.end();
      process.exit(0);
    } catch (e) {
      const msg = e.message.split("\n")[0].slice(0, 90);
      console.log(`❌ [${p.label}] [${h.label}] -> ${msg}`);
    }
  }
}
console.log("\nALL VARIANTS FAILED");
process.exit(1);
