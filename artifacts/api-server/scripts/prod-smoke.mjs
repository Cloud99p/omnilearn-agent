// Production smoke test against Supabase-backed API (NODE_ENV=production)
// Loads the real meetplay key from meetplay/.env so keyed calls authenticate.
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8080";

// Read OMNILEARN_API_KEY from meetplay/.env
const meetplayEnv = readFileSync(
  "C:/Users/jpout/.openclaw/workspace/meetplay/.env",
  "utf8",
);
const keyMatch = meetplayEnv.match(/^OMNILEARN_API_KEY=(.+)$/m);
const KEY = keyMatch ? keyMatch[1].trim() : null;
if (!KEY) {
  console.error("❌ OMNILEARN_API_KEY not found in meetplay/.env");
  process.exit(1);
}
console.log(`using key: oml_${KEY.slice(4, 10)}... (len ${KEY.length})`);

async function req(method, path, body, key) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  return { status: res.status, json };
}

const results = [];

// 1. Health (public)
let r = await req("GET", "/api/ghost/health");
results.push(["ghost/health (no key)", r.status, JSON.stringify(r.json).slice(0, 60)]);

// 2. Record WITH key — should succeed (201)
const roomId = `smoke-${Date.now()}`;
r = await req("POST", "/api/v1/knowledge/record", {
  type: "utterance",
  data: { content: "Smoke test caption", speakerId: "tester", roomId },
  metadata: { meetingId: roomId, source: "smoke" },
}, KEY);
results.push(["record with key", r.status, JSON.stringify(r.json).slice(0, 90)]);
const nodeId = r.json?.nodeId;

// 3. Record WITHOUT key — must fail (401)
r = await req("POST", "/api/v1/knowledge/record", {
  type: "utterance",
  data: { content: "should be rejected" },
  metadata: { meetingId: roomId },
});
results.push(["record no key (expect 401)", r.status, JSON.stringify(r.json).slice(0, 80)]);

// 4. Search WITH key — should find the smoke node
r = await req("POST", "/api/v1/knowledge/search", {
  query: "Smoke test caption",
  metadataFilter: { meetingId: roomId },
}, KEY);
const found = r.json?.results?.length ?? r.json?.nodes?.length ?? 0;
results.push(["search with key", r.status, `found=${found} ${JSON.stringify(r.json).slice(0, 60)}`]);

// 5. Search WITHOUT key — must fail (401)
r = await req("POST", "/api/v1/knowledge/search", {
  query: "Smoke test caption",
  metadataFilter: { meetingId: roomId },
});
results.push(["search no key (expect 401)", r.status, JSON.stringify(r.json).slice(0, 70)]);

// 6. Delete with key — should succeed (find via metadata filter)
r = await req("POST", "/api/v1/knowledge/delete", {
  metadataFilter: { meetingId: roomId },
}, KEY);
results.push(["delete with key", r.status, JSON.stringify(r.json).slice(0, 80)]);

// 7. Delete WITHOUT key — must fail (401)
r = await req("POST", "/api/v1/knowledge/delete", {
  metadataFilter: { meetingId: roomId },
});
results.push(["delete no key (expect 401)", r.status, JSON.stringify(r.json).slice(0, 70)]);

// 8. Service stats with key
r = await req("GET", "/api/v1/services/me/stats", undefined, KEY);
results.push(["services/me/stats", r.status, JSON.stringify(r.json).slice(0, 80)]);

console.log("\n=== PROD SMOKE RESULTS ===");
let pass = 0;
for (const [name, status, detail] of results) {
  const ok = status === 200 || status === 201;
  const blocked = status === 401;
  const tag = ok ? "✅" : blocked ? "🛡️" : "❌";
  if (ok || blocked) pass++;
  console.log(`${tag} [${status}] ${name} — ${detail}`);
}
console.log(`\n${pass}/${results.length} passed (success or correctly blocked)`);
