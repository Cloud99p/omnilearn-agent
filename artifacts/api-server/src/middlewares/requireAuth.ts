import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  clerkId: string;
}

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
