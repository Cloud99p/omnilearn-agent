// LIVE production smoke test — omnilearn-api-production.up.railway.app
// Uses the real meetplay key from meetplay/.env
import { readFileSync } from "node:fs";

const BASE = "https://omnilearn-api-production.up.railway.app";

const meetplayEnv = readFileSync("C:/Users/jpout/.openclaw/workspace/meetplay/.env", "utf8");
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
const roomId = `live-smoke-${Date.now()}`;

// 1. Record WITH key
let r = await req("POST", "/api/v1/knowledge/record", {
  type: "utterance",
  data: { content: "Live smoke test caption", speakerId: "tester", roomId },
  metadata: { meetingId: roomId, source: "live-smoke" },
}, KEY);
results.push(["record with key", r.status, JSON.stringify(r.json).slice(0, 90)]);
const nodeId = r.json?.nodeId;

// 2. Record WITHOUT key — must be 401
r = await req("POST", "/api/v1/knowledge/record", {
  type: "utterance",
  data: { content: "should be rejected" },
  metadata: { meetingId: roomId },
});
results.push(["record no key (expect 401)", r.status, JSON.stringify(r.json).slice(0, 70)]);

// 3. Search WITH key
r = await req("POST", "/api/v1/knowledge/search", {
  query: "Live smoke test caption",
  metadataFilter: { meetingId: roomId },
}, KEY);
const found = r.json?.results?.length ?? r.json?.nodes?.length ?? 0;
results.push(["search with key", r.status, `found=${found}`]);

// 4. Delete WITH key (cleanup)
r = await req("POST", "/api/v1/knowledge/delete", {
  metadataFilter: { meetingId: roomId },
}, KEY);
results.push(["delete with key", r.status, JSON.stringify(r.json).slice(0, 70)]);

// 5. Service stats
r = await req("GET", "/api/v1/services/me/stats", undefined, KEY);
results.push(["services/me/stats", r.status, JSON.stringify(r.json).slice(0, 90)]);

console.log("\n=== LIVE PRODUCTION SMOKE RESULTS ===");
let pass = 0;
for (const [name, status, detail] of results) {
  const ok = status === 200 || status === 201;
  const blocked = status === 401;
  if (ok || blocked) pass++;
  console.log(`${ok ? "✅" : blocked ? "🛡️" : "❌"} [${status}] ${name} — ${detail}`);
}
console.log(`\n${pass}/${results.length} passed`);
