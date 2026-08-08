import { readFileSync } from "node:fs";

/**
 * Production-guard test — run against a server started with NODE_ENV=production.
 * Expects: keyless record/batch/search/delete → 401; meetplay-keyed → 200/201.
 */
const BASE = "http://localhost:8080";
const MP_KEY = process.env.MEETPLAY_API_KEY || loadKeyFromEnv();
if (!MP_KEY) {
  console.error("MEETPLAY_API_KEY required (set env or meetplay/.env)");
  process.exit(1);
}

function loadKeyFromEnv() {
  try {
    const p = "C:/Users/jpout/.openclaw/workspace/meetplay/.env";
    const txt = readFileSync(p, "utf8");
    const m = txt.match(/^OMNILEARN_API_KEY=(.+)$/m);
    return m ? m[1].trim().replace(/\r$/, "") : null;
  } catch {
    return null;
  }
}

async function api(path, { method = "POST", key, body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

const failures = [];
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(label);
};

const probe = `prodguard-${Date.now()}`;
const meta = { probe };

// 1. keyless must be rejected in production
for (const [label, path, body] of [
  ["keyless record", "/api/v1/knowledge/record", { type: "utterance", data: { text: "x" }, metadata: meta }],
  ["keyless batch", "/api/v1/knowledge/batch", { records: [{ type: "utterance", data: { text: "x" } }], metadata: meta }],
  ["keyless search", "/api/v1/knowledge/search", { metadataFilter: meta }],
  ["keyless delete", "/api/v1/knowledge/delete", { metadataFilter: meta }],
]) {
  const r = await api(path, { body });
  check(`${label} → 401`, r.status === 401, `status=${r.status}`);
}

// 2. keyed works
const rec = await api("/api/v1/knowledge/record", { key: MP_KEY, body: { type: "utterance", data: { text: "prod guard ok" }, metadata: meta } });
check("keyed record → 201", rec.status === 201, `status=${rec.status}`);

const s = await api("/api/v1/knowledge/search", { key: MP_KEY, body: { metadataFilter: meta } });
check("keyed search finds node", s.status === 200 && (s.json.results || []).length === 1, `nodes=${(s.json.results || []).length}`);

const d = await api("/api/v1/knowledge/delete", { key: MP_KEY, body: { metadataFilter: meta } });
check("keyed delete cleans own", d.json.deleted === 1, `deleted=${d.json.deleted}`);

console.log(failures.length === 0 ? "\n🎉 PROD GUARD PASSED — keyless locked out, keyed works" : `\n${failures.length} FAILURES: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
