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
import { initSentry, sentryRequestHandler, sentryErrorHandler } from "./lib/sentry";

// Initialize Sentry (must be first, before any other imports)
initSentry();

const app: Express = express();

// ── Background ontology reflection ────
const ONTOLOGY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
function scheduleOntologyReflection() {
  runOntologyReflection().catch(err => logger.error(err, "Ontology reflection failed"));
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
app.use(cors({ 
  credentials: true, 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

// Sentry error handler (must be last, after all routes)
app.use(sentryErrorHandler());

export default app;
