/**
 * OmniLearn Agent
 * Copyright (c) 2026 Emmanuel Nenpan Hosea
 * Licensed under the AGPL v3 License
 */

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import * as Sentry from "@sentry/node";
import router from "./routes";
import syncRouter from "./routes/sync/index.js";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { runOntologyReflection } from "./brain/ontology.js";
import { NetworkService } from "./lib/network-service.js";
import { DiscoveryServer } from "./lib/discovery-server.js";
import { setDiscoveryServer } from "./lib/knowledge-sync.js";
import {
  initSentry,
  sentryRequestHandler,
  sentryErrorHandler,
} from "./lib/sentry";
import { rlsContextMiddleware } from "./middlewares/rlsContext";

// Initialize Sentry (must be first, before any other imports)
initSentry();

// Initialize network service (ClusterManager + Database)
const networkService = new NetworkService();
networkService.initialize().catch((err) =>
  logger.error(err, "Failed to initialize network service"),
);

// Initialize WebSocket discovery server for real-time node communication
const DISCOVERY_PORT = parseInt(process.env.DISCOVERY_PORT || "8765", 10);
let discoveryServer: DiscoveryServer | null = null;

try {
  discoveryServer = new DiscoveryServer(DISCOVERY_PORT);
  
  // Initialize knowledge sync with discovery server
  setDiscoveryServer(discoveryServer);
  
  // Handle node events
  discoveryServer.on("node-hello", (nodeId, message) => {
    logger.info({ nodeId, message }, "Node joined network");
    networkService.recordHeartbeat(nodeId, "online");
  });
  
  discoveryServer.on("heartbeat", (nodeId, message) => {
    logger.debug({ nodeId, load: message.data?.load }, "Node heartbeat");
    networkService.recordHeartbeat(nodeId, "online", message.data?.load);
  });
  
  discoveryServer.on("node-goodbye", (nodeId, message) => {
    logger.info({ nodeId }, "Node left network");
    networkService.recordHeartbeat(nodeId, "offline");
  });
  
  logger.info(
    { port: DISCOVERY_PORT },
    "WebSocket discovery server initialized",
  );
} catch (err) {
  logger.error({ err }, "Failed to initialize discovery server");
}

const app: Express = express();

// Trust Railway's proxy (fixes X-Forwarded-For errors)
// Use 'loopback' to satisfy express-rate-limit validation while still working with Railway
app.set("trust proxy", "loopback");

// ── Background ontology reflection ────
const ONTOLOGY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
function scheduleOntologyReflection() {
  runOntologyReflection().catch((err) =>
    logger.error(err, "Ontology reflection failed"),
  );
  setTimeout(scheduleOntologyReflection, ONTOLOGY_INTERVAL_MS);
}
scheduleOntologyReflection();
logger.info("Ontology reflection enabled (10min interval)");

// Sentry request handler (must be before other middleware)
app.use(sentryRequestHandler());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// RLS Context Middleware (must be after Clerk middleware)
// Sets PostgreSQL session variables for row-level security
app.use(rlsContextMiddleware);
logger.info("RLS context middleware enabled");

// Secure CORS configuration - restrict to specific origins
// SECURITY FIX: Prevent CSRF attacks by not allowing all origins with credentials
const ALLOWED_ORIGINS = [
  // Production (Railway deployment)
  /^https:\/\/.*\.up\.railway\.app$/,
  // Production (Vercel frontend)
  /^https:\/\/.*\.vercel\.app$/,
  // Custom domain (user's frontend)
  /^https:\/\/omnilearn\.dpdns\.org$/,
  // Development
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

function corsOriginValidator(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) {
    return callback(null, true);
  }
  
  // Check against allowlist
  const isAllowed = ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
  
  if (!isAllowed) {
    logger.warn({ origin }, "CORS request blocked: origin not in allowlist");
  }
  
  callback(null, isAllowed);
}

app.use(
  cors({
    credentials: true,
    origin: corsOriginValidator,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 86400, // Cache preflight for 24 hours
  }),
);
// Increase body size limit to 10MB (default is 100KB)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(clerkMiddleware());

app.use("/api", router);
app.use("/api/sync", syncRouter);

// Sentry error handler (must be last, after all routes)
app.use(sentryErrorHandler());

export default app;
