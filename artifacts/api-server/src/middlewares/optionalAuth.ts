import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  clerkId: string | null;
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
 * Require authentication - returns 401 if not authenticated
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

/**
 * Optional authentication - attaches clerkId if available, continues without error
 * Use for endpoints that work for both authenticated and anonymous users
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getClerkUserId(req);
  (req as AuthenticatedRequest).clerkId = userId;
  next();
}
