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

// ── Background ontology reflection — runs every 10 minutes ──────────────────
const ONTOLOGY_INTERVAL_MS = 10 * 60 * 1000;
function scheduleOntologyReflection() {
  setTimeout(async () => {
    try {
      const result = await runOntologyReflection();
      logger.info({ result }, "Scheduled ontology reflection complete");
    } catch (err) {
      logger.warn({ err }, "Scheduled ontology reflection failed");
    }
    scheduleOntologyReflection(); // reschedule after each run
  }, ONTOLOGY_INTERVAL_MS);
}
// Kick off first cycle shortly after startup (30 s delay to let DB settle)
setTimeout(async () => {
  try {
    const result = await runOntologyReflection();
    logger.info({ result }, "Initial ontology reflection complete");
  } catch (err) {
    logger.warn({ err }, "Initial ontology reflection failed");
  }
  scheduleOntologyReflection();
}, 30_000);

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

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
