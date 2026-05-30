# OmniLearn Access Control System Design

**Status:** 📋 Design Proposal  
**Date:** May 30, 2026  
**Version:** 1.0.0

---

## Current State (As of May 2026)

### Existing Access Control

**Model:** Binary ownership-based access

```typescript
// Current schema
knowledgeNodes {
  id: number
  clerkId: string | null  // Owner ID (null = public)
  content: string
  // ... other fields
}

conversations {
  id: number
  clerkId: string | null  // Owner ID (null = anonymous)
  title: string
  // ... other fields
}
```

**Access Logic:**
```typescript
// If authenticated + resource has clerkId
if (req.clerkId === resource.clerkId) {
  return ALLOW; // Owner access
}

// If anonymous/public resource
if (resource.clerkId === null) {
  return ALLOW; // Public access
}

// Otherwise
return DENY; // No access
```

**Limitations:**
- ❌ No role-based permissions
- ❌ No team/organization sharing
- ❌ No fine-grained actions (read vs write vs delete)
- ❌ No data type classification
- ❌ No delegation or inheritance
- ❌ No audit trail for access decisions

---

## Proposed Access Control System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Access Control Layer                   │
├─────────────────────────────────────────────────────────┤
│  Authentication (Clerk) → User + Roles + Teams          │
│         ↓                                                 │
│  Authorization Engine (RBAC + ABAC hybrid)              │
│         ↓                                                 │
│  Policy Evaluation: (User, Action, Resource, Context)   │
│         ↓                                                 │
│  Decision: ALLOW / DENY / CONDITIONAL                   │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Role-Based Access Control (RBAC)

### Role Hierarchy

```
┌─────────────────┐
│   Super Admin   │  ← Platform-wide (Emmanuel only)
└────────┬────────┘
         │
┌────────▼────────┐
│  Org Admin      │  ← Organization-level admin
└────────┬────────┘
         │
┌────────▼────────┐
│  Team Lead      │  ← Team-level admin
└────────┬────────┘
         │
┌────────▼────────┐
│  Member         │  ← Standard user
└────────┬────────┘
         │
┌────────▼────────┐
│  Viewer         │  ← Read-only access
└────────┬────────┘
         │
┌────────▼────────┐
│  Guest          │  ← Limited, time-bound access
└─────────────────┘
```

### Role Definitions

| Role | Create | Read | Update | Delete | Share | Admin |
|------|--------|------|--------|--------|-------|-------|
| **Super Admin** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Org Admin** | ✅ Org | ✅ Org | ✅ Org | ✅ Org | ✅ Org | ✅ Org |
| **Team Lead** | ✅ Team | ✅ Team | ✅ Team | ✅ Team | ✅ Team | ✅ Team |
| **Member** | ✅ Own | ✅ Team | ✅ Own | ✅ Own | ⚠️ Team | ❌ |
| **Viewer** | ❌ | ✅ Team | ❌ | ❌ | ❌ | ❌ |
| **Guest** | ❌ | ⚠️ Limited | ❌ | ❌ | ❌ | ❌ |

### Database Schema

```typescript
// New tables for RBAC

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  clerkOrganizationId: text("clerk_org_id"), // Clerk org ID if using Clerk orgs
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  clerkId: text("clerk_id").notNull(), // User ID
  role: text("role").notNull().default("member"), // admin, lead, member, viewer, guest
  invitedBy: text("invited_by"), // clerkId of inviter
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  joinedAt: timestamp("joined_at"),
  expiresAt: timestamp("expires_at"), // For guest access
  status: text("status").notNull().default("pending"), // pending, active, suspended
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // super_admin, org_admin, team_lead, member, viewer, guest
  description: text("description"),
  permissions: jsonb("permissions").notNull().default({}), // { knowledge: { read: true, write: true }, ... }
  isSystem: boolean("is_system").notNull().default(false), // System roles can't be deleted
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id),
  resourceType: text("resource_type").notNull(), // knowledge_node, conversation, team, organization
  action: text("action").notNull(), // create, read, update, delete, share, admin
  scope: text("scope").notNull().default("own"), // own, team, org, all
  condition: jsonb("condition"), // Optional conditions (e.g., "only during business hours")
});
```

---

## 2. Team Scoping

### Team Structure

```
Organization: "OmniLearn Labs"
├─ Team: "Core Development"
│  ├─ Emmanuel (Team Lead)
│  ├─ Developer 1 (Member)
│  └─ Developer 2 (Member)
├─ Team: "Research"
│  ├─ Researcher 1 (Team Lead)
│  └─ Researcher 2 (Member)
└─ Team: "External Collaborators"
   └─ Partner 1 (Guest, expires 2026-12-31)
```

### Resource Visibility by Scope

| Scope | Visible To |
|-------|------------|
| **Private** | Owner only |
| **Team** | All team members (based on role) |
| **Organization** | All org members |
| **Public** | Anyone (authenticated or anonymous) |

### Schema Updates for Scoping

```typescript
// Add to existing resource tables

export const knowledgeNodes = pgTable("knowledge_nodes", {
  // ... existing fields ...
  clerkId: text("clerk_id"), // Owner (null = system/public)
  
  // NEW: Access control fields
  visibility: text("visibility").notNull().default("private"), // private, team, org, public
  teamId: integer("team_id").references(() => teams.id), // Null = personal
  organizationId: integer("organization_id").references(() => organizations.id),
  
  // Inheritance: if teamId set, team members get access based on role
  // If organizationId set, org members get access based on role
});

export const conversations = pgTable("conversations", {
  // ... existing fields ...
  clerkId: text("clerk_id"),
  
  // NEW
  visibility: text("visibility").notNull().default("private"),
  teamId: integer("team_id").references(() => teams.id),
  organizationId: integer("organization_id").references(() => organizations.id),
});
```

---

## 3. Data Type Classification

### Sensitivity Levels

| Level | Description | Examples | Access Requirements |
|-------|-------------|----------|---------------------|
| **Public** | No restrictions | General knowledge, public facts | Anyone |
| **Internal** | Org/team only | Business logic, internal processes | Team members |
| **Confidential** | Need-to-know | User data, credentials, API keys | Owner + admins |
| **Restricted** | Highest security | PII, financial data, secrets | Owner only |

### Data Type Registry

```typescript
export const dataTypes = pgTable("data_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // pii, credentials, business_logic, general_knowledge
  sensitivityLevel: text("sensitivity_level").notNull(), // public, internal, confidential, restricted
  defaultVisibility: text("default_visibility").notNull(), // private, team, org, public
  requiresExplicitConsent: boolean("requires_explicit_consent").default(false),
  retentionDays: integer("retention_days"), // Null = indefinite
  autoClassifyPatterns: jsonb("auto_classify_patterns"), // Regex patterns for auto-classification
});

// Example data types
const DATA_TYPE_REGISTRY = {
  pii: {
    sensitivityLevel: "restricted",
    defaultVisibility: "private",
    requiresExplicitConsent: true,
    retentionDays: null, // GDPR: user controls
    autoClassifyPatterns: [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    ],
  },
  credentials: {
    sensitivityLevel: "restricted",
    defaultVisibility: "private",
    requiresExplicitConsent: true,
    retentionDays: null,
    autoClassifyPatterns: [
      /password\s*[:=]/i,
      /api[_-]?key\s*[:=]/i,
      /secret\s*[:=]/i,
      /token\s*[:=]/i,
    ],
  },
  business_logic: {
    sensitivityLevel: "internal",
    defaultVisibility: "team",
    requiresExplicitConsent: false,
    retentionDays: null,
  },
  general_knowledge: {
    sensitivityLevel: "public",
    defaultVisibility: "public",
    requiresExplicitConsent: false,
    retentionDays: null,
  },
};
```

### Auto-Classification Middleware

```typescript
// Automatically classify data on ingestion
export function classifyData(content: string): DataType {
  for (const [typeName, config] of Object.entries(DATA_TYPE_REGISTRY)) {
    for (const pattern of config.autoClassifyPatterns || []) {
      if (pattern.test(content)) {
        return {
          type: typeName,
          sensitivityLevel: config.sensitivityLevel,
          requiresReview: config.requiresExplicitConsent,
        };
      }
    }
  }
  return {
    type: "general_knowledge",
    sensitivityLevel: "public",
    requiresReview: false,
  };
}

// Usage in trainOnText
export async function trainOnText(
  text: string,
  source: string,
  clerkId: string | null,
) {
  // Auto-classify
  const classification = classifyData(text);
  
  // If restricted data, require explicit consent
  if (classification.requiresReview) {
    // Flag for review or reject
    await flagForReview(text, clerkId, classification);
    return { added: 0, skipped: 1, reason: "requires_review" };
  }
  
  // Proceed with normal storage
  // ...
}
```

---

## 4. Action-Based Permissions

### Permission Matrix

| Resource | Create | Read | Update | Delete | Share | Export | Admin |
|----------|--------|------|--------|--------|-------|--------|-------|
| **Knowledge Node (Own)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Knowledge Node (Team)** | ⚠️ | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ | ❌ |
| **Knowledge Node (Org)** | ⚠️ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| **Knowledge Node (Public)** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Conversation (Own)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Team** | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (Lead) |
| **Organization** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (Admin) |

⚠️ = Conditional (based on role)

### Permission Check Engine

```typescript
// Core authorization engine
export interface AccessRequest {
  user: {
    clerkId: string;
    roles: string[]; // ['member', 'viewer']
    teams: number[]; // [teamId1, teamId2]
    organizationId?: number;
  };
  action: 'create' | 'read' | 'update' | 'delete' | 'share' | 'export' | 'admin';
  resource: {
    type: 'knowledge_node' | 'conversation' | 'team' | 'organization';
    id: number;
    ownerId?: string | null;
    visibility: 'private' | 'team' | 'org' | 'public';
    teamId?: number | null;
    organizationId?: number | null;
    dataType?: string; // pii, credentials, etc.
  };
  context?: {
    time?: Date;
    location?: string;
    device?: string;
  };
}

export async function checkAccess(request: AccessRequest): Promise<AccessDecision> {
  // 1. Check if resource is public
  if (request.resource.visibility === 'public') {
    if (request.action === 'read' || request.action === 'export') {
      return { allowed: true, reason: 'public_resource' };
    }
  }
  
  // 2. Check ownership
  if (request.resource.ownerId === request.user.clerkId) {
    if (['create', 'read', 'update', 'delete', 'share', 'export'].includes(request.action)) {
      return { allowed: true, reason: 'owner' };
    }
  }
  
  // 3. Check team membership
  if (request.resource.teamId && request.user.teams.includes(request.resource.teamId)) {
    const teamRole = await getTeamRole(request.user.clerkId, request.resource.teamId);
    const permissions = await getRolePermissions(teamRole);
    
    if (permissions[request.resource.type]?.[request.action]) {
      return { allowed: true, reason: `team_${teamRole}` };
    }
  }
  
  // 4. Check organization membership
  if (request.resource.organizationId && request.user.organizationId === request.resource.organizationId) {
    const orgRole = await getOrgRole(request.user.clerkId, request.resource.organizationId);
    const permissions = await getRolePermissions(orgRole);
    
    if (permissions[request.resource.type]?.[request.action]) {
      return { allowed: true, reason: `org_${orgRole}` };
    }
  }
  
  // 5. Check data type restrictions
  if (request.resource.dataType) {
    const dataTypeConfig = DATA_TYPE_REGISTRY[request.resource.dataType];
    if (dataTypeConfig?.requiresExplicitConsent) {
      const hasConsent = await checkUserConsent(request.user.clerkId, request.resource.dataType);
      if (!hasConsent) {
        return { allowed: false, reason: 'missing_consent' };
      }
    }
  }
  
  // 6. Default deny
  return { allowed: false, reason: 'insufficient_permissions' };
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  condition?: string; // For conditional access
}
```

---

## 5. Implementation Phases

### Phase 1: Foundation (2-3 weeks)

**Goal:** Basic RBAC with roles and permissions

- [ ] Create database schema (organizations, teams, roles, permissions)
- [ ] Implement role assignment API
- [ ] Build permission check engine
- [ ] Update existing endpoints to use new access control
- [ ] Migration: existing resources → private visibility, owner-only access

**Deliverables:**
- `POST /api/teams` - Create team
- `POST /api/teams/:id/members` - Add member with role
- `GET /api/permissions/check` - Check access for resource
- Middleware: `requirePermission(resourceType, action)`

---

### Phase 2: Data Classification (1-2 weeks)

**Goal:** Auto-classify sensitive data

- [ ] Implement data type registry
- [ ] Add auto-classification middleware
- [ ] Build PII detection (enhanced from current moderation)
- [ ] Add consent management UI
- [ ] Implement data retention policies

**Deliverables:**
- Auto-classification on `trainOnText()`
- `GET /api/data-types` - List data types
- `POST /api/consent` - Grant/revoke consent
- Audit log for sensitive data access

---

### Phase 3: Team Sharing (2 weeks)

**Goal:** Team-based resource sharing

- [ ] Add visibility scopes to all resource tables
- [ ] Implement team resource sharing API
- [ ] Build sharing UI (frontend)
- [ ] Add team activity feed
- [ ] Implement team-level analytics

**Deliverables:**
- `POST /api/knowledge/:id/share` - Share with team
- `GET /api/teams/:id/resources` - List team resources
- Frontend: Share dialog, team dashboard

---

### Phase 4: Audit & Compliance (1-2 weeks)

**Goal:** Full audit trail and compliance

- [ ] Implement comprehensive audit logging
- [ ] Add access analytics dashboard
- [ ] Build compliance reports (GDPR, NDPR)
- [ ] Implement data export (user data portability)
- [ ] Add right-to-erasure workflow

**Deliverables:**
- `GET /api/audit/logs` - Access logs
- `GET /api/audit/reports/:type` - Compliance reports
- `POST /api/users/me/export` - Export my data
- `POST /api/users/me/delete` - Delete my data

---

## 6. API Examples

### Check Permissions

```bash
# Check if user can edit a knowledge node
GET /api/permissions/check?resourceType=knowledge_node&resourceId=123&action=update

# Response
{
  "allowed": true,
  "reason": "team_member",
  "role": "member",
  "teamId": 456
}
```

### Share Resource

```bash
# Share knowledge node with team
POST /api/knowledge/123/share
{
  "teamId": 456,
  "visibility": "team",
  "permissions": {
    "read": true,
    "write": false,
    "delete": false
  }
}
```

### Create Team

```bash
POST /api/teams
{
  "name": "AI Research",
  "organizationId": 789,
  "defaultRole": "member"
}
```

### Add Team Member

```bash
POST /api/teams/456/members
{
  "clerkId": "user_abc123",
  "role": "viewer",
  "expiresAt": "2026-12-31T23:59:59Z"  // Guest access
}
```

---

## 7. Security Considerations

### Principle of Least Privilege

- Default role: **Viewer** (read-only)
- Explicit grant required for write/delete
- Time-bound access for guests (expiresAt)
- Regular access reviews (quarterly)

### Defense in Depth

1. **Authentication** (Clerk) - Who are you?
2. **Authorization** (RBAC) - What can you do?
3. **Data Classification** - What type of data?
4. **Audit Logging** - What did you do?
5. **Rate Limiting** - How often can you do it?

### Audit Trail

Every access decision logged:
```typescript
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: number;
  decision: 'ALLOW' | 'DENY';
  reason: string;
  context: {
    ip: string;
    userAgent: string;
    location?: string;
  };
}
```

---

## 8. Migration Path

### Current → New System

```sql
-- Phase 1: Add new tables
CREATE TABLE organizations (...);
CREATE TABLE teams (...);
CREATE TABLE team_members (...);
CREATE TABLE roles (...);
CREATE TABLE role_permissions (...);

-- Phase 2: Add visibility columns to existing tables
ALTER TABLE knowledge_nodes 
  ADD COLUMN visibility TEXT DEFAULT 'private',
  ADD COLUMN team_id INTEGER REFERENCES teams(id),
  ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

ALTER TABLE conversations 
  ADD COLUMN visibility TEXT DEFAULT 'private',
  ADD COLUMN team_id INTEGER REFERENCES teams(id),
  ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

-- Phase 3: Migrate existing data
-- All existing resources → private, owner-only
UPDATE knowledge_nodes SET visibility = 'private' WHERE team_id IS NULL;
UPDATE conversations SET visibility = 'private' WHERE team_id IS NULL;

-- Phase 4: Create default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
  ('super_admin', 'Platform administrator', '{"*": {"*": true}}', true),
  ('org_admin', 'Organization administrator', '{"organization": {"admin": true}, "*": {"read": true, "write": true}}', true),
  ('team_lead', 'Team leader', '{"team": {"admin": true}, "*": {"read": true, "write": true}}', true),
  ('member', 'Standard member', '{"*": {"read": true, "write": true}}', true),
  ('viewer', 'Read-only viewer', '{"*": {"read": true}}', true),
  ('guest', 'Time-bound guest', '{"*": {"read": true}}', true);
```

---

## 9. Testing Strategy

### Unit Tests

```typescript
describe('Access Control', () => {
  test('Owner can edit own knowledge node', async () => {
    const decision = await checkAccess({
      user: { clerkId: 'user_123', roles: ['member'], teams: [] },
      action: 'update',
      resource: {
        type: 'knowledge_node',
        id: 1,
        ownerId: 'user_123',
        visibility: 'private',
      },
    });
    expect(decision.allowed).toBe(true);
  });

  test('Team member can read team knowledge node', async () => {
    // ...
  });

  test('Viewer cannot delete knowledge node', async () => {
    // ...
  });

  test('PII data requires explicit consent', async () => {
    // ...
  });
});
```

### Integration Tests

- End-to-end permission checks
- Team sharing workflows
- Data classification pipeline
- Audit log verification

### Penetration Testing

- Privilege escalation attempts
- Horizontal privilege escalation (access other user's data)
- Vertical privilege escalation (gain admin rights)
- Data exfiltration attempts

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Unauthorized access attempts blocked** | 100% | Audit logs |
| **Permission check latency** | <10ms p95 | Performance monitoring |
| **False positive denials** | <1% | User support tickets |
| **Data classification accuracy** | >95% | Manual review sample |
| **Audit log completeness** | 100% | Log analysis |

---

## Next Steps

1. **Review & approve** this design document
2. **Prioritize phases** based on business needs
3. **Create detailed specs** for Phase 1
4. **Implement & test** iteratively
5. **Deploy to staging** for user testing
6. **Roll out to production** with feature flags

---

**Last Updated:** May 30, 2026  
**Author:** Security Architecture Review  
**Status:** 📋 Design Proposal (Pending Review)
