/**
 * SDK smoke test — runs the OmniLearnClient against the live local server.
 * Usage: node smoke-sdk.mjs (uses dist build) or npx tsx smoke-sdk.ts
 * Requires: api-server running on :8080
 */
import { OmniLearnClient } from "./dist/index.js";

const BASE = process.env.API_BASE_URL || "http://localhost:8080";
const client = new OmniLearnClient({
  apiKey: "dev-key",
  apiBaseUrl: BASE,
  serviceName: "meetplay-sdk-smoke",
  serviceVersion: "0.1.0",
  domain: "meetings",
  enableLogging: false,
  retryAttempts: 1,
  timeout: 8000,
});

const meetingId = `sdk-smoke-${Date.now()}`;
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// 1. recordBatch with top-level metadata
try {
  const batch = await client.recordBatch({
    metadata: { meetingId },
    records: [
      { type: "utterance", data: { text: "We should ship the mobile app first", speakerId: "p1", speakerName: "Chidi" } },
      { type: "utterance", data: { text: "I disagree, web is faster to launch", speakerId: "p2", speakerName: "Ayo" } },
      { type: "utterance", data: { text: "Let's ask the users what they want", speakerId: "p3", speakerName: "Bola" } },
    ],
  });
  check("recordBatch", batch.recorded === 3 && batch.failed === 0, JSON.stringify(batch));
} catch (e) {
  check("recordBatch", false, String(e.message || e));
}

// 2. search with metadataFilter
try {
  const res = await client.search({
    metadataFilter: { meetingId },
    types: ["utterance"],
    limit: 10,
  });
  check("search(metadataFilter)", res.nodes.length === 3, `nodes=${res.nodes.length} total=${res.total}`);
  if (res.nodes[0]) {
    check("node shape", !!res.nodes[0].data && !!res.nodes[0].metadata, JSON.stringify({ data: res.nodes[0].data, meta: res.nodes[0].metadata }).slice(0, 120));
  }
} catch (e) {
  check("search(metadataFilter)", false, String(e.message || e));
}

// 3. record single
try {
  const r = await client.recordAndWait({
    type: "utterance",
    data: { text: "Single record via SDK", speakerId: "p1", speakerName: "Chidi" },
    metadata: { meetingId },
  });
  check("recordAndWait", !!r.nodeId && r.status === "recorded", `nodeId=${r.nodeId} status=${r.status} hash=${r.proofHash || "?"}`);
} catch (e) {
  check("recordAndWait", false, String(e.message || e));
}

// 4. getStats
try {
  const stats = await client.getStats();
  check("getStats", typeof stats.totalNodes === "number", `totalNodes=${stats.totalNodes} nodesByType=${stats.nodesByType.length}`);
} catch (e) {
  check("getStats", false, String(e.message || e));
}

// 5. delete by metadataFilter
try {
  const del = await client.delete({ metadataFilter: { meetingId } });
  check("delete(metadataFilter)", del.deleted >= 3, `deleted=${del.deleted} matched=${del.matched}`);
} catch (e) {
  check("delete(metadataFilter)", false, String(e.message || e));
}

// 6. verify gone
try {
  const res = await client.search({ metadataFilter: { meetingId }, types: ["utterance"], limit: 10 });
  check("search after delete (empty)", res.nodes.length === 0, `nodes=${res.nodes.length}`);
} catch (e) {
  check("search after delete (empty)", false, String(e.message || e));
}

console.log(failures === 0 ? "\n🎉 SDK SMOKE PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
