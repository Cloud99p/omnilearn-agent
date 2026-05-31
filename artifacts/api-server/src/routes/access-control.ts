/**
 * Access Control API Routes
 * 
 * Endpoints for managing:
 * - Organizations
 * - Teams
 * - Roles & Permissions
 * - Team Memberships
 * - Data Type Consents
 * - Permission Checks
 */

import { Router } from 'express';
import { db } from '@workspace/db';
import {
  organizations,
  teams,
  roles,
  rolePermissions,
  teamMembers,
  dataTypes,
  userConsents,
  auditLogs,
} from '@workspace/db/schema';
import { eq, and, desc, or, isNull, gte, sql } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from '../middlewares/requireAuth';
import { checkAccess, requirePermission, logAudit, getUserPermissionsSummary, invalidatePermissionCache } from '../lib/access-control';
import { logger } from '../lib/logger';

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// Permission Check Endpoint
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/access/check
 * Check if user has permission for a specific action on a resource
 */
router.post('/check', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { action, resourceType, resourceId, resourceOwnerId, resourceVisibility, resourceTeamId, resourceOrgId, dataType } = req.body;

  if (!action || !resourceType) {
    return res.status(400).json({ error: 'action and resourceType are required' });
  }

  const accessRequest = {
    user: { clerkId: authReq.clerkId },
    action,
    resource: {
      type: resourceType,
      id: resourceId,
      ownerId: resourceOwnerId,
      visibility: resourceVisibility,
      teamId: resourceTeamId,
      organizationId: resourceOrgId,
      dataType,
    },
    context: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  };

  const result = await checkAccess(accessRequest);

  // Log the check
  await logAudit(
    authReq.clerkId,
    'permission_check',
    resourceType,
    resourceId,
    result.decision,
    result.reason,
    accessRequest.context
  );

  res.json({
    allowed: result.allowed,
    decision: result.decision,
    reason: result.reason,
  });
});

/**
 * GET /api/access/permissions
 * Get current user's permissions summary
 */
router.get('/permissions', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  
  try {
    const summary = await getUserPermissionsSummary(authReq.clerkId);
    res.json(summary);
  } catch (err) {
    logger.error({ err, clerkId: authReq.clerkId, stack: err instanceof Error ? err.stack : 'no stack' }, 'Failed to get permissions summary');
    res.status(500).json({ error: 'Failed to get permissions', details: err instanceof Error ? err.message : String(err) });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Organizations
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/access/organizations
 * Create a new organization
 */
router.post('/organizations', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { name, slug, description, logo } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'name and slug are required' });
  }

  try {
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        slug,
        description,
        logo,
      })
      .returning();

    // Automatically add creator as org admin
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, 'org_admin'))
      .limit(1);

    if (adminRole[0]) {
      // Create a default team for the organization
      const [defaultTeam] = await db
        .insert(teams)
        .values({
          organizationId: org.id,
          name: 'Default',
          slug: 'default',
          description: 'Default team for organization members',
        })
        .returning();

      // Add creator to default team as admin
      await db.insert(teamMembers).values({
        teamId: defaultTeam.id,
        clerkId: authReq.clerkId,
        roleId: adminRole[0].id,
        status: 'active',
        joinedAt: new Date(),
      });
    }

    await logAudit(authReq.clerkId, 'organization_create', 'organization', org.id, 'ALLOW', 'owner');

    res.status(201).json(org);
  } catch (err) {
    logger.error({ err }, 'Failed to create organization');
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

/**
 * GET /api/access/organizations
 * List organizations user belongs to
 */
router.get('/organizations', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  try {
    // Get user's teams and their organizations
    const userTeams = await db
      .select({
        organizationId: teams.organizationId,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
      })
      .from(teamMembers)
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .leftJoin(organizations, eq(teams.organizationId, organizations.id))
      .where(
        and(
          eq(teamMembers.clerkId, authReq.clerkId),
          eq(teamMembers.status, 'active')
        )
      );

    // Deduplicate organizations
    const orgMap = new Map();
    userTeams.forEach(t => {
      if (t.organizationId && !orgMap.has(t.organizationId)) {
        orgMap.set(t.organizationId, {
          id: t.organizationId,
          name: t.organizationName,
          slug: t.organizationSlug,
        });
      }
    });

    res.json(Array.from(orgMap.values()));
  } catch (err) {
    logger.error({ err }, 'Failed to list organizations');
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Teams
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/access/teams
 * Create a new team
 */
router.post('/teams', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { organizationId, name, slug, description } = req.body;

  if (!organizationId || !name || !slug) {
    return res.status(400).json({ error: 'organizationId, name, and slug are required' });
  }

  try {
    // Check if user has permission to create team in this org
    const accessResult = await checkAccess({
      user: { clerkId: authReq.clerkId },
      action: 'create',
      resource: {
        type: 'team',
        organizationId,
      },
    });

    if (!accessResult.allowed) {
      return res.status(403).json({ error: 'Forbidden', reason: accessResult.reason });
    }

    const [team] = await db
      .insert(teams)
      .values({
        organizationId,
        name,
        slug,
        description,
      })
      .returning();

    await logAudit(authReq.clerkId, 'team_create', 'team', team.id, 'ALLOW');

    res.status(201).json(team);
  } catch (err) {
    logger.error({ err }, 'Failed to create team');
    res.status(500).json({ error: 'Failed to create team' });
  }
});

/**
 * GET /api/access/teams
 * List teams user belongs to
 */
router.get('/teams', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        description: teams.description,
        organizationId: teams.organizationId,
        organizationName: organizations.name,
        role: roles.name,
      })
      .from(teamMembers)
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .leftJoin(organizations, eq(teams.organizationId, organizations.id))
      .leftJoin(roles, eq(teamMembers.roleId, roles.id))
      .where(
        and(
          eq(teamMembers.clerkId, authReq.clerkId),
          eq(teamMembers.status, 'active'),
          or(
            isNull(teamMembers.expiresAt),
            gte(teamMembers.expiresAt, new Date())
          )
        )
      );

    res.json(userTeams);
  } catch (err) {
    logger.error({ err }, 'Failed to list teams');
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

/**
 * GET /api/access/teams/:id
 * Get team details
 */
router.get('/teams/:id', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const teamId = parseInt(req.params.id, 10);

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check access
    const accessResult = await checkAccess({
      user: { clerkId: authReq.clerkId },
      action: 'read',
      resource: {
        type: 'team',
        id: teamId,
        teamId,
      },
    });

    if (!accessResult.allowed) {
      return res.status(403).json({ error: 'Forbidden', reason: accessResult.reason });
    }

    // Get team members
    const members = await db
      .select({
        clerkId: teamMembers.clerkId,
        role: roles.name,
        status: teamMembers.status,
        joinedAt: teamMembers.joinedAt,
        expiresAt: teamMembers.expiresAt,
      })
      .from(teamMembers)
      .leftJoin(roles, eq(teamMembers.roleId, roles.id))
      .where(eq(teamMembers.teamId, teamId));

    res.json({
      ...team,
      members,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get team');
    res.status(500).json({ error: 'Failed to get team' });
  }
});

/**
 * POST /api/access/teams/:id/members
 * Add member to team
 */
router.post('/teams/:id/members', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const teamId = parseInt(req.params.id, 10);
  const { clerkId, roleId, expiresAt } = req.body;

  if (!clerkId) {
    return res.status(400).json({ error: 'clerkId is required' });
  }

  try {
    // Check if current user has permission to add members
    const accessResult = await checkAccess({
      user: { clerkId: authReq.clerkId },
      action: 'admin',
      resource: {
        type: 'team',
        id: teamId,
        teamId,
      },
    });

    if (!accessResult.allowed) {
      return res.status(403).json({ error: 'Forbidden', reason: accessResult.reason });
    }

    // Get default role if not specified
    let actualRoleId = roleId;
    if (!actualRoleId) {
      const [defaultRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.isDefault, true))
        .limit(1);
      actualRoleId = defaultRole?.id;
    }

    // Add member
    const [member] = await db
      .insert(teamMembers)
      .values({
        teamId,
        clerkId,
        roleId: actualRoleId,
        invitedBy: authReq.clerkId,
        status: 'active',
        joinedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    // Invalidate cache for the added user
    invalidatePermissionCache(clerkId);

    await logAudit(authReq.clerkId, 'team_member_add', 'team', teamId, 'ALLOW', `added ${clerkId}`);

    res.status(201).json(member);
  } catch (err) {
    logger.error({ err }, 'Failed to add team member');
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

/**
 * DELETE /api/access/teams/:id/members/:clerkId
 * Remove member from team
 */
router.delete('/teams/:id/members/:clerkId', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const teamId = parseInt(req.params.id, 10);
  const memberClerkId = req.params.clerkId;

  try {
    // Check if current user has permission to remove members
    const accessResult = await checkAccess({
      user: { clerkId: authReq.clerkId },
      action: 'admin',
      resource: {
        type: 'team',
        id: teamId,
        teamId,
      },
    });

    if (!accessResult.allowed) {
      return res.status(403).json({ error: 'Forbidden', reason: accessResult.reason });
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.clerkId, memberClerkId)
        )
      );

    // Invalidate cache for the removed user
    invalidatePermissionCache(memberClerkId);

    await logAudit(authReq.clerkId, 'team_member_remove', 'team', teamId, 'ALLOW', `removed ${memberClerkId}`);

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to remove team member');
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Data Type Consents
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/access/data-types
 * List available data types
 */
router.get('/data-types', requireAuth, async (req, res) => {
  try {
    const dataTypesList = await db.select().from(dataTypes);
    res.json(dataTypesList);
  } catch (err) {
    logger.error({ err }, 'Failed to list data types');
    res.status(500).json({ error: 'Failed to list data types' });
  }
});

/**
 * GET /api/access/consents
 * Get user's current consents
 */
router.get('/consents', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const consents = await db
      .select({
        dataType: dataTypes.name,
        displayName: dataTypes.display_name,
        sensitivityLevel: dataTypes.sensitivity_level,
        granted: userConsents.granted,
        grantedAt: userConsents.grantedAt,
        revokedAt: userConsents.revokedAt,
        expiresAt: userConsents.expiresAt,
      })
      .from(userConsents)
      .leftJoin(dataTypes, eq(userConsents.dataTypeId, dataTypes.id))
      .where(eq(userConsents.clerkId, authReq.clerkId));

    res.json(consents);
  } catch (err) {
    logger.error({ err }, 'Failed to get consents');
    res.status(500).json({ error: 'Failed to get consents' });
  }
});

/**
 * POST /api/access/consents
 * Grant or revoke consent for a data type
 */
router.post('/consents', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { dataTypeName, granted } = req.body;

  if (!dataTypeName) {
    return res.status(400).json({ error: 'dataTypeName is required' });
  }

  try {
    // Get data type
    const [dataType] = await db
      .select()
      .from(dataTypes)
      .where(eq(dataTypes.name, dataTypeName))
      .limit(1);

    if (!dataType) {
      return res.status(404).json({ error: 'Data type not found' });
    }

    // Upsert consent
    const [consent] = await db
      .insert(userConsents)
      .values({
        clerkId: authReq.clerkId,
        dataTypeId: dataType.id,
        granted: granted !== false, // Default to true
        revokedAt: granted === false ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [userConsents.clerkId, userConsents.dataTypeId],
        set: {
          granted: granted !== false,
          revokedAt: granted === false ? new Date() : null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAudit(authReq.clerkId, 'consent_update', 'data_type', dataType.id, 'ALLOW', `granted=${granted}`);

    res.json(consent);
  } catch (err) {
    logger.error({ err }, 'Failed to update consent');
    res.status(500).json({ error: 'Failed to update consent' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Audit Logs (Admin Only)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/access/audit-logs
 * Get audit logs (requires admin permission)
 */
router.get('/audit-logs', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { limit = 100, offset = 0, action, resourceType } = req.query;

  try {
    // Check if user has admin permission
    const accessResult = await checkAccess({
      user: { clerkId: authReq.clerkId },
      action: 'admin',
      resource: {
        type: 'organization',
      },
    });

    if (!accessResult.allowed) {
      return res.status(403).json({ error: 'Forbidden', reason: accessResult.reason });
    }

    // Build query
    let query = db.select().from(auditLogs);
    
    if (action) {
      query = query.where(eq(auditLogs.action, action as string));
    }
    
    if (resourceType) {
      query = query.where(eq(auditLogs.resourceType, resourceType as string));
    }

    const logs = await query
      .orderBy(desc(auditLogs.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs);

    res.json({
      logs,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: total[0]?.count || 0,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get audit logs');
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

export default router;
