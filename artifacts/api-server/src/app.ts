import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { runOntologyReflection } from "./brain/ontology.js";

const app: Express = express();

// ── Background ontology reflection — DISABLED TEMPORARILY ──────────────────
// Enable after pushing database schema to Supabase
// const ONTOLOGY_INTERVAL_MS = 10 * 60 * 1000;
// function scheduleOntologyReflection() { ... }
// logger.info("Ontology reflection enabled");

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

export default app;
