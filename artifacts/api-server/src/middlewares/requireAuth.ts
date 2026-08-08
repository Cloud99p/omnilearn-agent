import type { Request, Response, NextFunction } from "express";
import { getClerkUserId, type AuthenticatedRequest } from "./optionalAuth.js";

/**
 * Require authentication - returns 401 if not authenticated.
 * Safe in keyless (no Clerk) environments: treats every request as
 * unauthenticated instead of throwing.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getClerkUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthenticatedRequest).clerkId = userId;
  next();
}
