import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export interface AuthenticatedRequest extends Request {
  clerkId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  
  // Debug logging
  logger.debug({ 
    hasAuth: !!auth, 
    userId, 
    sessionId: auth?.sessionId,
    headers: req.headers.authorization ? 'Present' : 'Missing' 
  }, 'requireAuth check');
  
  if (!userId) {
    logger.warn({ auth }, 'Auth failed - no userId');
    res.status(401).json({ error: "Unauthorized", debug: { hasAuth: !!auth, hasToken: !!req.headers.authorization } });
    return;
  }
  (req as AuthenticatedRequest).clerkId = userId;
  logger.debug({ clerkId: userId }, 'Auth successful');
  next();
}
