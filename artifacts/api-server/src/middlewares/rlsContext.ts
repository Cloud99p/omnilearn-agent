/**
 * RLS Context Middleware
 * 
 * Sets PostgreSQL session variables for Row Level Security (RLS) based on Clerk auth.
 * This ensures all database queries in a request are automatically scoped to the user.
 * 
 * Usage:
 *   app.use(rlsContextMiddleware);
 * 
 * Then in routes, use req.db instead of importing db directly:
 *   const nodes = await (req as any).db.select().from(knowledgeNodes);
 */

import type { Request, Response, NextFunction } from 'express';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@workspace/db/schema';
import { logger } from '../lib/logger';

const { Pool } = pg;

export interface RLSRequest extends Request {
  db: ReturnType<typeof drizzle>;
  clerkId?: string;
  organizationId?: number;
}

/**
 * Middleware to set RLS context based on Clerk authentication
 */
export async function rlsContextMiddleware(
  req: RLSRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get Clerk user ID from auth (set by Clerk middleware)
    const clerkId = (req as any).auth?.userId || (req as any).clerkId;
    
    if (!clerkId) {
      // No auth, continue without RLS context
      // (public endpoints or unauthenticated requests)
      return next();
    }

    // Create a new database client with RLS context
    const client = new Pool({ 
      connectionString: process.env.DATABASE_URL!,
      max: 1, // Single connection for this request
    });

    // Set RLS context for this connection
    await client.query('SET app.current_user_id = $1', [clerkId]);

    // Try to get organization ID from user's team memberships
    let organizationId: number | undefined;
    try {
      const orgResult = await client.query(`
        SELECT o.id
        FROM organizations o
        JOIN teams t ON t.organization_id = o.id
        JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.clerk_id = $1 AND tm.status = 'active'
        LIMIT 1
      `, [clerkId]);

      organizationId = orgResult.rows[0]?.id;
      
      if (organizationId) {
        await client.query('SET app.current_org_id = $1', [organizationId]);
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch organization for RLS context');
    }

    // Create Drizzle client with RLS context
    const dbWithRls = drizzle(client, { schema });

    // Attach to request
    req.db = dbWithRls;
    req.clerkId = clerkId;
    req.organizationId = organizationId;

    // Clean up connection after response
    res.on('finish', () => {
      client.end().catch(err => {
        logger.warn({ err }, 'Failed to close RLS database client');
      });
    });

    logger.debug(
      { clerkId, organizationId },
      'RLS context set for request'
    );

    next();
  } catch (err) {
    logger.error({ err }, 'Failed to set RLS context');
    next(err);
  }
}

/**
 * Helper to get RLS context from request
 */
export function getRLSContext(req: Request): {
  clerkId?: string;
  organizationId?: number;
} {
  const rlsReq = req as RLSRequest;
  return {
    clerkId: rlsReq.clerkId,
    organizationId: rlsReq.organizationId,
  };
}
