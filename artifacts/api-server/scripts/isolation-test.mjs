/**
 * Definitive service isolation test — real Bearer headers (no shell mangling).
 * Proves: record as meetplay → only meetplay sees it; a decoy service cannot.
 */
const BASE = "http://localhost:8080";
const MP_KEY = process.env.MEETPLAY_API_KEY;

if (!MP_KEY) {
  console.error("MEETPLAY_API_KEY required");
  process.exit(1);
}

async function api(path, { method = "GET", key, body } = {}) {
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

// 1. validate meetplay key
const v = await api("/api/v1/services/validate", { method: "POST", key: MP_KEY });
check("validate meetplay key", v.status === 200 && v.json.service?.name === "meetplay", `status=${v.status}`);

// 2. register decoy
const decoyName = `decoy-${Date.now()}`;
const d = await api("/api/v1/services/register", {
  method: "POST",
  body: { name: decoyName, ownerEmail: "decoy@example.com", domain: "other" },
});
check("register decoy", d.status === 201, `status=${d.status}`);
const DECOY_KEY = d.json.apiKey;

// 3. record as meetplay
const probe = `iso3-${Date.now()}`;
const rec = await api("/api/v1/knowledge/record", {
  method: "POST",
  key: MP_KEY,
  body: { type: "utterance", data: { text: "isolation test" }, metadata: { probe } },
});
check("record as meetplay", rec.status === 201, `nodeId=${rec.json.nodeId}`);

// 4. meetplay sees own node
const s1 = await api("/api/v1/knowledge/search", {
  method: "POST",
  key: MP_KEY,
  body: { metadataFilter: { probe }, limit: 5 },
});
check("meetplay sees own node", (s1.json.results || []).length === 1, `nodes=${(s1.json.results || []).length}`);

// 5. decoy must NOT see it
const s2 = await api("/api/v1/knowledge/search", {
  method: "POST",
  key: DECOY_KEY,
  body: { metadataFilter: { probe }, limit: 5 },
});
check("decoy CANNOT see meetplay node", (s2.json.results || []).length === 0, `nodes=${(s2.json.results || []).length}`);

// 6. keyless dev view still sees everything
const s3 = await api("/api/v1/knowledge/search", {
  method: "POST",
  body: { metadataFilter: { probe }, limit: 5 },
});
check("keyless dev view sees node", (s3.json.results || []).length === 1, `nodes=${(s3.json.results || []).length}`);

// 7. decoy delete cannot touch meetplay's node (scoped delete)
const del = await api("/api/v1/knowledge/delete", {
  method: "POST",
  key: DECOY_KEY,
  body: { metadataFilter: { probe } },
});
check("decoy delete touches 0 nodes", del.json.deleted === 0, `deleted=${del.json.deleted}`);

// 8. meetplay can clean up its own
const del2 = await api("/api/v1/knowledge/delete", {
  method: "POST",
  key: MP_KEY,
  body: { metadataFilter: { probe } },
});
check("meetplay delete cleans own", del2.json.deleted === 1, `deleted=${del2.json.deleted}`);

console.log(failures.length === 0 ? "\n🎉 ISOLATION PASSED — services fully scoped" : `\n${failures.length} FAILURES: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
