import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  clerkId: string | null;
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
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
  const auth = getAuth(req);
  const userId = auth?.userId;
  (req as AuthenticatedRequest).clerkId = userId || null;
  next();
}
