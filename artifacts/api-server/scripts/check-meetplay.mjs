import pg from "pg";
(async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query("SELECT name, status, api_key_prefix, left(api_key_hash,12) AS hash_p FROM service_registrations WHERE name='meetplay'");
  console.log(JSON.stringify(r.rows));
  await c.end();
})().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
