/**
 * V1 Services API - Registration Endpoints
 * POST /api/v1/services/register  — public onboarding: issue an API key
 * POST /api/v1/services/validate  — exchange a key for service identity
 */

import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { serviceRegistrations } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { optionalAuth, AuthenticatedRequest, sha256Hex } from "../../../middlewares/optionalAuth.js";
import { logger } from "../../../lib/logger.js";

const router = Router();

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/; // lowercase, letters/digits/hyphens
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `oml_${randomBytes(24).toString("hex")}`; // 49 chars, 192 bits entropy
  const prefix = `oml_${key.slice(4, 12)}`; // human-recognizable, e.g. oml_4f2a91c3
  const hash = sha256Hex(key);
  return { key, prefix, hash };
}

/** POST /api/v1/services/register — public (no auth): create a service + API key */
router.post("/register", async (req, res) => {
  try {
    const body = req.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
    const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : "";

    if (!NAME_RE.test(name)) {
      res.status(400).json({
        success: false,
        error: "name must be 2-64 chars, lowercase letters/digits/hyphens, starting alphanumeric",
      });
      return;
    }
    if (!EMAIL_RE.test(ownerEmail)) {
      res.status(400).json({ success: false, error: "ownerEmail must be a valid email" });
      return;
    }

    // Name uniqueness
    const existing = await db
      .select({ id: serviceRegistrations.id })
      .from(serviceRegistrations)
      .where(eq(serviceRegistrations.name, name))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ success: false, error: `service "${name}" is already registered` });
      return;
    }

    const { key, prefix, hash } = generateApiKey();

    const [row] = await db
      .insert(serviceRegistrations)
      .values({
        name,
        ownerEmail,
        version: typeof body.version === "string" ? body.version.slice(0, 32) : "1.0.0",
        description: typeof body.description === "string" ? body.description.slice(0, 500) : null,
        domain: typeof body.domain === "string" ? body.domain.slice(0, 64) : "general",
        knowledgeTypes: Array.isArray(body.knowledgeTypes)
          ? body.knowledgeTypes.filter((t: unknown) => typeof t === "string").slice(0, 50)
          : [],
        rateLimit: Number.isInteger(body.rateLimit) ? Math.min(Math.max(body.rateLimit, 1), 10000) : 60,
        apiKeyPrefix: prefix,
        apiKeyHash: hash,
        status: "active",
      })
      .returning({ id: serviceRegistrations.id });

    logger.info({ serviceId: row.id, name }, "Service registered via v1 API");

    // Plaintext key returned ONCE — never stored.
    res.status(201).json({
      success: true,
      serviceId: row.id,
      apiKey: key,
      apiKeyPrefix: prefix,
      status: "active",
    });
  } catch (error) {
    logger.error({ error }, "Failed to register service");
    res.status(500).json({ success: false, error: "Failed to register service" });
  }
});

/** POST /api/v1/services/validate — API-key auth: resolve the calling service */
router.post("/validate", optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.service) {
      res.status(401).json({ success: false, error: "Invalid or missing API key" });
      return;
    }
    res.json({
      success: true,
      service: {
        id: authReq.service.id,
        name: authReq.service.name,
        domain: authReq.service.domain,
        version: authReq.service.version,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to validate service key");
    res.status(500).json({ success: false, error: "Failed to validate service key" });
  }
});

export default router;
