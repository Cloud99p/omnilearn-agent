import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const startTime = Date.now();

router.get("/healthz", async (_req, res) => {
  const checks: {
    status: "ok" | "degraded" | "error";
    version: string;
    uptime: number;
    timestamp: string;
    database?: { status: "connected" | "error"; latencyMs?: number };
    clerk?: { status: "configured" | "missing" };
  } = {
    status: "ok",
    version: process.env.npm_package_version || "0.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  };

  // Database health check
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - dbStart;
    checks.database = { status: "connected", latencyMs: dbLatency };
    logger.debug({ dbLatency }, "Database health check passed");
  } catch (error) {
    checks.database = { status: "error" };
    checks.status = "degraded";
    logger.error({ error }, "Database health check failed");
  }

  // Clerk configuration check
  if (process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    checks.clerk = { status: "configured" };
  } else {
    checks.clerk = { status: "missing" };
    checks.status = "degraded";
    logger.warn("Clerk keys not configured");
  }

  const data = HealthCheckResponse.parse(checks);
  res.json(data);
});

export default router;
