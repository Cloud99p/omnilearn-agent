import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import { serviceRegistrations } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  clerkId: string | null;
  /** Resolved service identity when a valid `Bearer oml_...` API key is used */
  service?: {
    id: string;
    name: string;
    domain: string;
    version: string;
  } | null;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Safely read Clerk auth. Returns null when Clerk middleware is not
 * registered (e.g. keyless local dev) or the request carries no token —
 * never throws.
 */
export function getClerkUserId(req: Request): string | null {
  try {
    const auth = getAuth(req);
    return auth?.userId ?? null;
  } catch {
    // Clerk middleware not mounted (local dev without CLERK keys)
    return null;
  }
}

/**
 * Resolve a service from `Authorization: Bearer oml_...` (if present).
 * Returns null when no key, malformed key, or unknown key — never throws.
 */
async function resolveServiceFromKey(req: Request): Promise<AuthenticatedRequest["service"]> {
  const header = (req.headers.authorization ?? "").trim();
  if (!header.startsWith("Bearer ")) return null;
  const apiKey = header.slice("Bearer ".length).trim();
  if (!apiKey.startsWith("oml_")) return null;

  const hash = sha256Hex(apiKey);
  const rows = await db
    .select({ id: serviceRegistrations.id, name: serviceRegistrations.name, domain: serviceRegistrations.domain, version: serviceRegistrations.version, status: serviceRegistrations.status, apiKeyHash: serviceRegistrations.apiKeyHash })
    .from(serviceRegistrations)
    .where(eq(serviceRegistrations.apiKeyHash, hash))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "active") return null;

  // Constant-time compare as a second check (hash index already narrows it)
  const stored = Buffer.from(row.apiKeyHash, "hex");
  const given = Buffer.from(hash, "hex");
  if (stored.length !== given.length || !timingSafeEqual(stored, given)) return null;

  return { id: row.id, name: row.name, domain: row.domain, version: row.version };
}

/**
 * Optional authentication - attaches clerkId and/or service identity if
 * available, continues without error.
 * Use for endpoints that work for both authenticated and anonymous users.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getClerkUserId(req);
  const authReq = req as AuthenticatedRequest;
  authReq.clerkId = userId;
  try {
    authReq.service = await resolveServiceFromKey(req);
  } catch {
    authReq.service = null;
  }
  next();
}

/**
 * Require authentication - returns 401 if not authenticated
 * (accepts either a Clerk session or a valid service API key).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getClerkUserId(req);
  const authReq = req as AuthenticatedRequest;
  authReq.clerkId = userId;
  try {
    authReq.service = await resolveServiceFromKey(req);
  } catch {
    authReq.service = null;
  }
  if (!userId && !authReq.service) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
