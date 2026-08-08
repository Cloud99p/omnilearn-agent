/**
 * SDK smoke test — proves @cloud99p/omnilearn-sdk works for ANY service.
 *
 * Uses two fictional, unrelated services (a trading bot and a health app) to
 * demonstrate the SDK is domain-agnostic: record → search(metadataFilter) →
 * delete → verify. Run: node smoke-sdk.mjs (uses dist build)
 * Requires: api-server running on :8080
 */
import { OmniLearnClient } from "./dist/index.js";

const BASE = process.env.API_BASE_URL || "http://localhost:8080";

// Two unrelated services — the SDK must treat them identically
const tradeBot = new OmniLearnClient({
  apiKey: "dev-key",
  apiBaseUrl: BASE,
  serviceName: "trade-bot",
  serviceVersion: "2.1.0",
  domain: "blockchain",
  enableLogging: false,
  retryAttempts: 1,
  timeout: 8000,
});

const healthApp = new OmniLearnClient({
  apiKey: "dev-key",
  apiBaseUrl: BASE,
  serviceName: "health-app",
  serviceVersion: "1.0.0",
  domain: "healthcare",
  enableLogging: false,
  retryAttempts: 1,
  timeout: 8000,
});

const tradeRunId = `trade-run-${Date.now()}`;
const patientId = `patient-${Date.now()}`;
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// ── Service A: trading bot records executions ────────────────────────────
try {
  const batch = await tradeBot.recordBatch({
    metadata: { runId: tradeRunId },
    records: [
      { type: "trade_executed", data: { symbol: "BTC/USDT", side: "buy", qty: 0.25, price: 67200 } },
      { type: "trade_executed", data: { symbol: "ETH/USDT", side: "sell", qty: 2.0, price: 3510 } },
      { type: "signal_generated", data: { symbol: "SOL/USDT", action: "accumulate", confidence: 0.81 } },
    ],
  });
  check("trade-bot recordBatch", batch.recorded === 3 && batch.failed === 0, JSON.stringify(batch));
} catch (e) {
  check("trade-bot recordBatch", false, String(e.message || e));
}

// ── Service B: health app records vitals (same SDK, different domain) ───
try {
  const r = await healthApp.recordAndWait({
    type: "vitals_check",
    data: { patientId, bp: "120/80", hr: 72, spo2: 98 },
    metadata: { patientId },
  });
  check("health-app recordAndWait", !!r.nodeId && r.status === "recorded", `nodeId=${r.nodeId}`);
} catch (e) {
  check("health-app recordAndWait", false, String(e.message || e));
}

// ── Cross-service isolation: search scoped per service metadata ─────────
try {
  const trades = await tradeBot.search({ metadataFilter: { runId: tradeRunId }, limit: 10 });
  check("trade-bot search(runId)", trades.nodes.length === 3, `nodes=${trades.nodes.length}`);
  check("trade node shape", trades.nodes.some((n) => n?.data?.symbol === "BTC/USDT"), JSON.stringify(trades.nodes.map((n) => n.data?.symbol)).slice(0, 90));
} catch (e) {
  check("trade-bot search(runId)", false, String(e.message || e));
}

try {
  const vitals = await healthApp.search({ metadataFilter: { patientId }, limit: 10 });
  check("health-app search(patientId)", vitals.nodes.length === 1, `nodes=${vitals.nodes.length}`);
} catch (e) {
  check("health-app search(patientId)", false, String(e.message || e));
}

// ── Stats per service ────────────────────────────────────────────────────
try {
  const stats = await tradeBot.getStats();
  check("trade-bot getStats", typeof stats.totalNodes === "number", `totalNodes=${stats.totalNodes}`);
} catch (e) {
  check("trade-bot getStats", false, String(e.message || e));
}

// ── Privacy: each service deletes only its own nodes ────────────────────
try {
  const del = await healthApp.delete({ metadataFilter: { patientId } });
  check("health-app delete(patientId)", del.deleted >= 1, `deleted=${del.deleted}`);
} catch (e) {
  check("health-app delete(patientId)", false, String(e.message || e));
}

try {
  const del = await tradeBot.delete({ metadataFilter: { runId: tradeRunId } });
  check("trade-bot delete(runId)", del.deleted >= 3, `deleted=${del.deleted}`);
} catch (e) {
  check("trade-bot delete(runId)", false, String(e.message || e));
}

// ── Verify cleanup ───────────────────────────────────────────────────────
try {
  const after = await tradeBot.search({ metadataFilter: { runId: tradeRunId }, limit: 10 });
  check("trade-bot search after delete", after.nodes.length === 0, `nodes=${after.nodes.length}`);
} catch (e) {
  check("trade-bot search after delete", false, String(e.message || e));
}

console.log(failures === 0 ? "\n🎉 SDK SMOKE PASSED — SDK is service-agnostic" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
