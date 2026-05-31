import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
const { Pool } = pg;
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export * from "./schema";
/**
 * Create a database client with RLS context for Clerk authentication
 *
 * This sets PostgreSQL session variables that RLS policies use for access control:
 * - app.current_user_id: Clerk user ID
 * - app.current_org_id: Organization ID (optional)
 *
 * @param clerkId - Clerk user ID for RLS
 * @param organizationId - Optional organization ID for org-scoped queries
 * @returns Database client with RLS context
 *
 * @example
 * ```typescript
 * // In API middleware
 * app.use(async (req, res, next) => {
 *   const clerkId = req.auth?.userId;
 *   if (clerkId) {
 *     req.db = createDbClientWithUser(clerkId);
 *   }
 *   next();
 * });
 * ```
 */
export function createDbClientWithUser(clerkId, organizationId) {
    const client = new Pool({ connectionString: process.env.DATABASE_URL });
    // Set RLS context for this connection
    client.query('SET LOCAL app.current_user_id = $1', [clerkId]).catch(err => {
        console.error('Failed to set RLS user context:', err);
    });
    if (organizationId) {
        client.query('SET LOCAL app.current_org_id = $1', [organizationId]).catch(err => {
            console.error('Failed to set RLS org context:', err);
        });
    }
    return drizzle(client, { schema });
}
/**
 * Execute a function with RLS context for a specific user
 *
 * @param clerkId - Clerk user ID for RLS
 * @param fn - Async function to execute with RLS context
 * @param organizationId - Optional organization ID
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * await withUserContext('user_123', async (db) => {
 *   const nodes = await db.select().from(knowledgeNodes);
 *   // Only returns nodes visible to user_123 (enforced by RLS)
 * });
 * ```
 */
export async function withUserContext(clerkId, fn, organizationId) {
    const client = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        // Set RLS context
        await client.query('SET LOCAL app.current_user_id = $1', [clerkId]);
        if (organizationId) {
            await client.query('SET LOCAL app.current_org_id = $1', [organizationId]);
        }
        const dbWithRls = drizzle(client, { schema });
        return await fn(dbWithRls);
    }
    finally {
        await client.end();
    }
}
