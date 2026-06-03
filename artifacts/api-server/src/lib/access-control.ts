/**
 * Access Control Engine
 * 
 * Implements RBAC + ABAC hybrid authorization system
 * Evaluates: (User + Roles + Teams) × (Action) × (Resource + Type + Scope) → ALLOW/DENY
 */

import { db } from "@workspace/db";
// Import directly from individual schema files (bypass broken barrel export)
import { teamMembers, roles, rolePermissions, organizations, teams, dataTypes, userConsents, auditLogs } from "@workspace/db/schema/access-control";
import { knowledgeNodes } from "@workspace/db/schema/knowledge-nodes";
import { conversations } from "@workspace/db/schema/conversations";
import { eq, and, or, sql, gte, lte, isNull } from "drizzle-orm";
import { logger } from "./logger";
import { permissionCache, isRedisAvailable } from "./redis.js";

// Debug: Log schema imports
logger.info('Schema tables loaded:', {
  teamMembers: !!teamMembers,
  roles: !!roles,
  teams: !!teams,
  rolePermissions: !!rolePermissions,
  dataTypes: !!dataTypes,
  userConsents: !!userConsents,
  auditLogs: !!auditLogs,
  knowledgeNodes: !!knowledgeNodes,
  conversations: !!conversations,
  organizations: !!organizations,
});

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type AccessAction = 'create' | 'read' | 'update' | 'delete' | 'share' | 'export' | 'admin';
export type ResourceType = 'knowledge_node' | 'conversation' | 'team' | 'organization' | '*';
export type VisibilityScope = 'private' | 'team' | 'org' | 'public';
export type AccessDecision = 'ALLOW' | 'DENY';

export interface AccessRequest {
  user: {
    clerkId: string;
    roles?: string[]; // Cached role names
    teams?: number[]; // Team IDs user belongs to
    organizationId?: number;
  };
  action: AccessAction;
  resource: {
    type: ResourceType;
    id?: number;
    ownerId?: string | null;
    visibility?: VisibilityScope;
    teamId?: number | null;
    organizationId?: number | null;
    dataType?: string;
  };
  context?: {
    ip?: string;
    userAgent?: string;
    location?: string;
  };
}

export interface AccessDecisionResult {
  allowed: boolean;
  decision: AccessDecision;
  reason: string;
  condition?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Permission Cache (for performance)
// ──────────────────────────────────────────────────────────────────────────────

interface PermissionCache {
  userId: string;
  roles: string[];
  teams: number[];
  organizationId?: number;
  permissions: Map<string, boolean>;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedPermissions(clerkId: string): Promise<PermissionCache | null> {
  // Try Redis first
  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    try {
      const cached = await permissionCache.get<PermissionCache>(clerkId);
      if (cached && Date.now() < cached.expiresAt) {
        return cached;
      }
    } catch (err) {
      logger.warn({ err }, 'Redis permission cache get failed, falling back to in-memory');
    }
  }
  
  // Fall back to in-memory
  const cached = PERMISSION_CACHE.get(clerkId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }
  
  return null;
}

async function setCachedPermissions(clerkId: string, cache: PermissionCache): Promise<void> {
  // Store in Redis (async, fire-and-forget)
  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    permissionCache.set(clerkId, cache).catch((err) => {
      logger.warn({ err }, 'Redis permission cache set failed');
    });
  }
  
  // Always store in-memory as fallback
  PERMISSION_CACHE.set(clerkId, cache);
}

// ──────────────────────────────────────────────────────────────────────────────
// Core Permission Check Engine
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if user has permission to perform action on resource
 */
export async function checkAccess(request: AccessRequest): Promise<AccessDecisionResult> {
  const { user, action, resource } = request;
  
  // 1. Check if resource is public (anyone can read/export)
  if (resource.visibility === 'public') {
    if (action === 'read' || action === 'export') {
      return {
        allowed: true,
        decision: 'ALLOW',
        reason: 'public_resource',
      };
    }
  }

  // 2. Check ownership (owner has full control over their resources)
  if (resource.ownerId === user.clerkId) {
    if (['create', 'read', 'update', 'delete', 'share', 'export'].includes(action)) {
      return {
        allowed: true,
        decision: 'ALLOW',
        reason: 'owner',
      };
    }
  }

  // 3. Load user's roles and team memberships
  const userPermissions = await loadUserPermissions(user.clerkId);
  
  // 4. Check team-based access
  if (resource.teamId && userPermissions.teams.includes(resource.teamId)) {
    const teamRole = await getTeamRole(user.clerkId, resource.teamId);
    if (teamRole) {
      const hasPermission = await checkRolePermission(teamRole, resource.type, action, 'team');
      if (hasPermission) {
        return {
          allowed: true,
          decision: 'ALLOW',
          reason: `team_${teamRole}`,
        };
      }
    }
  }

  // 5. Check organization-based access
  if (resource.organizationId && userPermissions.organizationId === resource.organizationId) {
    const orgRole = await getOrgRole(user.clerkId, resource.organizationId);
    if (orgRole) {
      const hasPermission = await checkRolePermission(orgRole, resource.type, action, 'org');
      if (hasPermission) {
        return {
          allowed: true,
          decision: 'ALLOW',
          reason: `org_${orgRole}`,
        };
      }
    }
  }

  // 6. Check data type restrictions (sensitive data requires explicit consent)
  if (resource.dataType) {
    const dataTypeConfig = await getDataTypeConfig(resource.dataType);
    if (dataTypeConfig?.requiresExplicitConsent) {
      const hasConsent = await checkUserConsent(user.clerkId, resource.dataType);
      if (!hasConsent) {
        await logAudit(user.clerkId, 'access_check', resource.type, resource.id, 'DENY', 'missing_consent', request.context);
        return {
          allowed: false,
          decision: 'DENY',
          reason: 'missing_consent',
        };
      }
    }
  }

  // 7. Default deny
  await logAudit(user.clerkId, 'access_check', resource.type, resource.id, 'DENY', 'insufficient_permissions', request.context);
  return {
    allowed: false,
    decision: 'DENY',
    reason: 'insufficient_permissions',
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Permission Loading
// ──────────────────────────────────────────────────────────────────────────────

async function loadUserPermissions(clerkId: string): Promise<{
  roles: string[];
  teams: number[];
  organizationId?: number;
}> {
  // Check cache first (Redis or in-memory)
  const cached = await getCachedPermissions(clerkId);
  if (cached) {
    return {
      roles: cached.roles,
      teams: cached.teams,
      organizationId: cached.organizationId,
    };
  }

  // Load team memberships
  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      roleName: roles.name,
      organizationId: teams.organizationId,
    })
    .from(teamMembers)
    .leftJoin(roles, eq(teamMembers.roleId, roles.id))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.clerkId, clerkId),
        eq(teamMembers.status, 'active'),
        or(
          isNull(teamMembers.expiresAt),
          gte(teamMembers.expiresAt, new Date())
        )
      )
    );

  const userRoles = [...new Set(memberships.map(m => m.roleName).filter((r): r is string => !!r))];
  const userTeams = [...new Set(memberships.map(m => m.teamId))];
  const organizationId = memberships[0]?.organizationId;

  // Cache results (Redis + in-memory)
  const cache: PermissionCache = {
    userId: clerkId,
    roles: userRoles,
    teams: userTeams,
    organizationId,
    permissions: new Map(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  await setCachedPermissions(clerkId, cache);

  return { roles: userRoles, teams: userTeams, organizationId };
}

// ──────────────────────────────────────────────────────────────────────────────
// Role-Based Permission Checks
// ──────────────────────────────────────────────────────────────────────────────

async function checkRolePermission(
  roleName: string,
  resourceType: ResourceType,
  action: AccessAction,
  scope: 'own' | 'team' | 'org' | 'all'
): Promise<boolean> {
  // Load role permissions
  const permissions = await db
    .select()
    .from(rolePermissions)
    .leftJoin(roles, eq(rolePermissions.roleId, roles.id))
    .where(eq(roles.name, roleName));

  // Check for wildcard permissions (super admin)
  const wildcardPermission = permissions.find(
    p => p.role_permissions?.resourceType === '*' && p.role_permissions?.action === '*'
  );
  if (wildcardPermission) {
    return true;
  }

  // Check for specific permission
  const hasPermission = permissions.some(p => {
    const matchesResource = p.role_permissions?.resourceType === resourceType || p.role_permissions?.resourceType === '*';
    const matchesAction = p.role_permissions?.action === action || p.role_permissions?.action === '*';
    const matchesScope = p.role_permissions?.scope === scope || p.role_permissions?.scope === 'all';
    return matchesResource && matchesAction && matchesScope;
  });

  return hasPermission;
}

async function getTeamRole(clerkId: string, teamId: number): Promise<string | null> {
  const membership = await db
    .select({ roleName: roles.name })
    .from(teamMembers)
    .leftJoin(roles, eq(teamMembers.roleId, roles.id))
    .where(
      and(
        eq(teamMembers.clerkId, clerkId),
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.status, 'active')
      )
    )
    .limit(1);

  return membership[0]?.roleName || null;
}

async function getOrgRole(clerkId: string, organizationId: number): Promise<string | null> {
  // For now, use team lead role from any team in the org as org role
  // This is simplified - real implementation would have separate org_memberships table
  const membership = await db
    .select({ roleName: roles.name })
    .from(teamMembers)
    .leftJoin(roles, eq(teamMembers.roleId, roles.id))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.clerkId, clerkId),
        eq(teams.organizationId, organizationId),
        eq(teamMembers.status, 'active'),
        eq(roles.name, 'org_admin')
      )
    )
    .limit(1);

  return membership[0]?.roleName || null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Data Type & Consent Checks
// ──────────────────────────────────────────────────────────────────────────────

async function getDataTypeConfig(dataTypeName: string): Promise<{
  sensitivityLevel: string;
  requiresExplicitConsent: boolean;
} | null> {
  const dataType = await db
    .select()
    .from(dataTypes)
    .where(eq(dataTypes.name, dataTypeName))
    .limit(1);

  if (!dataType[0]) return null;

  return {
    sensitivityLevel: dataType[0].sensitivityLevel,
    requiresExplicitConsent: dataType[0].requiresExplicitConsent,
  };
}

async function checkUserConsent(clerkId: string, dataTypeName: string): Promise<boolean> {
  const consent = await db
    .select()
    .from(userConsents)
    .leftJoin(dataTypes, eq(userConsents.dataTypeId, dataTypes.id))
    .where(
      and(
        eq(userConsents.clerkId, clerkId),
        eq(dataTypes.name, dataTypeName),
        eq(userConsents.granted, true),
        or(
          isNull(userConsents.revokedAt),
          isNull(userConsents.expiresAt),
          gte(userConsents.expiresAt, new Date())
        )
      )
    )
    .limit(1);

  return consent.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit Logging
// ──────────────────────────────────────────────────────────────────────────────

export async function logAudit(
  clerkId: string,
  action: string,
  resourceType?: string,
  resourceId?: number,
  decision?: AccessDecision,
  reason?: string,
  context?: { ip?: string; userAgent?: string; location?: string }
) {
  try {
    await db.insert(auditLogs).values({
      clerkId,
      action,
      resourceType,
      resourceId,
      decision: decision || 'ALLOW',
      reason,
      context: context || {},
    });
  } catch (err) {
    logger.warn({ err, clerkId, action }, 'Failed to log audit event');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Express Middleware
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  clerkId: string;
}

/**
 * Middleware to check permissions before allowing request
 * 
 * Usage:
 * router.post('/knowledge', requirePermission('knowledge_node', 'create'), handler);
 */
export function requirePermission(resourceType: ResourceType, action: AccessAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;

    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract resource ID from params if available
    const resourceId = req.params.id ? parseInt(req.params.id, 10) : undefined;

    // For now, do a simple check - in real implementation, load resource details
    const accessRequest: AccessRequest = {
      user: { clerkId },
      action,
      resource: {
        type: resourceType,
        id: resourceId,
      },
      context: {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    };

    const result = await checkAccess(accessRequest);

    if (!result.allowed) {
      await logAudit(clerkId, 'middleware_check', resourceType, resourceId, 'DENY', result.reason, accessRequest.context);
      return res.status(403).json({ 
        error: 'Forbidden',
        reason: result.reason,
      });
    }

    // Attach permission result to request for downstream use
    (req as any).permissionResult = result;
    next();
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get user's effective permissions summary
 */
export async function getUserPermissionsSummary(
  clerkId: string,
  queryDb: typeof db = db
): Promise<{
  roles: string[];
  teams: { id: number; name: string; role: string }[];
  organization?: { id: number; name: string };
}> {
  logger.info({ clerkId }, 'Loading permissions summary');
  
  const permData = await loadUserPermissions(clerkId);
  logger.info({ clerkId, permData }, 'Permission data loaded');
  
  const { roles: userRoles, teams: userTeamIds, organizationId } = permData;

  logger.info({ clerkId, teamCount: userTeamIds.length }, 'Fetching team details');
  
  const teamDetails = await queryDb
    .select({
      id: teams.id,
      name: teams.name,
      roleName: roles.name,
    })
    .from(teamMembers)
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(roles, eq(teamMembers.roleId, roles.id))
    .where(
      and(
        eq(teamMembers.clerkId, clerkId),
        eq(teamMembers.status, 'active')
      )
    );

  logger.info({ clerkId, teamDetailsCount: teamDetails.length }, 'Team details fetched');

  // Fetch organization through RLS-compliant path (via team_members -> teams -> organizations)
  let organization;
  if (organizationId) {
    logger.info({ clerkId, organizationId }, 'Fetching organization via RLS-compliant path');
    try {
      const orgResult = await queryDb
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(teamMembers)
        .leftJoin(teams, eq(teamMembers.teamId, teams.id))
        .leftJoin(organizations, eq(teams.organizationId, organizations.id))
        .where(
          and(
            eq(teamMembers.clerkId, clerkId),
            eq(organizations.id, organizationId),
            eq(teamMembers.status, 'active')
          )
        )
        .limit(1);
      
      organization = orgResult[0] ? { id: orgResult[0].id, name: orgResult[0].name } : undefined;
      logger.info({ clerkId, organization }, 'Organization fetched');
    } catch (orgErr) {
      logger.warn({ clerkId, organizationId, err: orgErr }, 'Organization query failed - continuing without org');
      organization = undefined;
    }
  }

  const result = {
    roles: userRoles || [],
    teams: teamDetails.map(t => ({ id: t.id, name: t.name, role: t.roleName || 'member' })),
    organization,
  };
  
  logger.info({ clerkId, resultKeys: Object.keys(result), teamsCount: result.teams.length, hasOrg: !!organization }, 'Permissions summary complete');
  return result;
}

/**
 * Invalidate permission cache for a user (e.g., after role change)
 */
export function invalidatePermissionCache(clerkId: string) {
  PERMISSION_CACHE.delete(clerkId);
}

/**
 * Clear all permission cache (e.g., during maintenance)
 */
export function clearPermissionCache() {
  PERMISSION_CACHE.clear();
}
