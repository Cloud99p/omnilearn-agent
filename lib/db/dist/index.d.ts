import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
export declare const pool: import("pg").Pool;
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
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
export declare function createDbClientWithUser(clerkId: string, organizationId?: number): import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
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
export declare function withUserContext<T>(clerkId: string, fn: (db: ReturnType<typeof drizzle>) => Promise<T>, organizationId?: number): Promise<T>;
//# sourceMappingURL=index.d.ts.map