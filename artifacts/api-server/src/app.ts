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
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { runOntologyReflection } from "./brain/ontology.js";
import { initializeClusterManager } from "./network-hierarchy.js";
import { DiscoveryServer } from "./lib/discovery-server.js";
import {
  initSentry,
  sentryRequestHandler,
  sentryErrorHandler,
} from "./lib/sentry";

// Initialize Sentry (must be first, before any other imports)
initSentry();

// Initialize 7-tier mesh network cluster manager
initializeClusterManager().catch((err) =>
  logger.error(err, "Failed to initialize cluster manager"),
);

// Initialize WebSocket discovery server for real-time node communication
const DISCOVERY_PORT = parseInt(process.env.DISCOVERY_PORT || "8765", 10);
let discoveryServer: DiscoveryServer | null = null;

try {
  discoveryServer = new DiscoveryServer(DISCOVERY_PORT);
  
  // Handle node events
  discoveryServer.on("node-hello", (nodeId, message) => {
    logger.info({ nodeId, message }, "Node joined network");
  });
  
  discoveryServer.on("heartbeat", (nodeId, message) => {
    logger.debug({ nodeId, load: message.data?.load }, "Node heartbeat");
  });
  
  discoveryServer.on("node-goodbye", (nodeId, message) => {
    logger.info({ nodeId }, "Node left network");
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
app.set("trust proxy", true);

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

// Allow all origins (for development + Vercel + Railway)
app.use(
  cors({
    credentials: true,
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Increase body size limit to 10MB (default is 100KB)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(clerkMiddleware());

app.use("/api", router);

// Sentry error handler (must be last, after all routes)
app.use(sentryErrorHandler());

export default app;
