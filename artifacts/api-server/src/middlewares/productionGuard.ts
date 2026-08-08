/**
 * ProductionGuard middleware
 *
 * In production (NODE_ENV === "production"), knowledge endpoints require an
 * authenticated caller — either a Clerk user OR a valid service API key.
 *
 * Rationale: the omnilearn API is internet-public on Railway. Without this,
 * keyless requests could record/delete knowledge nodes non-attributably,
 * and the delete route's keyless branch matches ALL rows (data-destruction
 * risk). This middleware closes that hole in production while preserving
 * the permissive "keyless local dev" experience.
 *
 * It relies on optionalAuth having run first (so req.clerkId / req.service
 * are populated). In non-production environments it is a no-op passthrough.
 */
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./optionalAuth";

export function requireAuthInProduction(req: Request, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return next();

  const authReq = req as AuthenticatedRequest;
  if (authReq.clerkId || authReq.service) return next();

  res.status(401).json({
    success: false,
    error:
      "Authentication required in production — provide a Clerk session or a valid service API key (Authorization: Bearer oml_...)",
  });
}
