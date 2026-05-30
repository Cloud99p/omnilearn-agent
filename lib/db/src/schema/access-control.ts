/**
 * Access Control Schema - RBAC + Team Management
 * 
 * Implements:
 * - Organizations
 * - Teams
 * - Roles & Permissions
 * - Team Memberships
 * - Data Classifications
 */

import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations } from "drizzle-orm";

// ──────────────────────────────────────────────────────────────────────────────
// Organizations
// ──────────────────────────────────────────────────────────────────────────────

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    clerkOrganizationId: text("clerk_org_id").unique(), // Clerk org ID if using Clerk orgs
    description: text("description"),
    logo: text("logo"), // URL to logo
    metadata: jsonb("metadata").default({}), // Custom metadata
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(table.slug),
    clerkOrgIdx: index("organizations_clerk_org_idx").on(table.clerkOrganizationId),
  })
);

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Teams
// ──────────────────────────────────────────────────────────────────────────────

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdIdx: index("teams_organization_id_idx").on(table.organizationId),
    orgSlugUnique: uniqueIndex("teams_org_slug_unique").on(table.organizationId, table.slug),
  })
);

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Roles
// ──────────────────────────────────────────────────────────────────────────────

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(), // super_admin, org_admin, team_lead, member, viewer, guest
    displayName: text("display_name").notNull(), // "Super Admin", "Team Lead", etc.
    description: text("description"),
    permissions: jsonb("permissions").notNull().default({}), // { knowledge_node: { read: true, write: true }, ... }
    isSystem: boolean("is_system").notNull().default(false), // System roles can't be deleted
    isDefault: boolean("is_default").notNull().default(false), // Default role for new members
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("roles_name_idx").on(table.name),
  })
);

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Role Permissions (granular permission definitions)
// ──────────────────────────────────────────────────────────────────────────────

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(), // knowledge_node, conversation, team, organization
    action: text("action").notNull(), // create, read, update, delete, share, export, admin
    scope: text("scope").notNull().default("own"), // own, team, org, all
    condition: jsonb("condition"), // Optional conditions (e.g., { timeRestriction: "business_hours" })
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    roleIdIdx: index("role_permissions_role_id_idx").on(table.roleId),
    resourceActionIdx: index("role_permissions_resource_action_idx").on(table.resourceType, table.action),
  })
);

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Team Members
// ──────────────────────────────────────────────────────────────────────────────

export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id").notNull(), // User ID
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    invitedBy: text("invited_by"), // clerkId of inviter
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // For guest access
    status: text("status").notNull().default("pending"), // pending, active, suspended, removed
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    teamIdIdx: index("team_members_team_id_idx").on(table.teamId),
    clerkIdIdx: index("team_members_clerk_id_idx").on(table.clerkId),
    teamClerkUnique: uniqueIndex("team_members_team_clerk_unique").on(table.teamId, table.clerkId),
    statusIdx: index("team_members_status_idx").on(table.status),
  })
);

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  invitedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Data Types (for classification)
// ──────────────────────────────────────────────────────────────────────────────

export const dataTypes = pgTable(
  "data_types",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(), // pii, credentials, business_logic, general_knowledge
    displayName: text("display_name").notNull(),
    sensitivityLevel: text("sensitivity_level").notNull(), // public, internal, confidential, restricted
    description: text("description"),
    defaultVisibility: text("default_visibility").notNull().default("private"), // private, team, org, public
    requiresExplicitConsent: boolean("requires_explicit_consent").notNull().default(false),
    retentionDays: integer("retention_days"), // Null = indefinite
    autoClassifyPatterns: jsonb("auto_classify_patterns"), // Regex patterns for auto-classification
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("data_types_name_idx").on(table.name),
    sensitivityIdx: index("data_types_sensitivity_idx").on(table.sensitivityLevel),
  })
);

export const insertDataTypeSchema = createInsertSchema(dataTypes).omit({
  id: true,
  createdAt: true,
});

export type DataType = typeof dataTypes.$inferSelect;
export type InsertDataType = z.infer<typeof insertDataTypeSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// User Consents (for sensitive data types)
// ──────────────────────────────────────────────────────────────────────────────

export const userConsents = pgTable(
  "user_consents",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    dataTypeId: integer("data_type_id")
      .notNull()
      .references(() => dataTypes.id),
    granted: boolean("granted").notNull().default(true),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    clerkIdIdx: index("user_consents_clerk_id_idx").on(table.clerkId),
    clerkDataTypeUnique: uniqueIndex("user_consents_clerk_data_type_unique").on(table.clerkId, table.dataTypeId),
  })
);

export const insertUserConsentSchema = createInsertSchema(userConsents).omit({
  id: true,
  grantedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type UserConsent = typeof userConsents.$inferSelect;
export type InsertUserConsent = z.infer<typeof insertUserConsentSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Audit Logs (for access tracking)
// ──────────────────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    action: text("action").notNull(), // access_check, resource_create, resource_read, etc.
    resourceType: text("resource_type"), // knowledge_node, conversation, team, etc.
    resourceId: integer("resource_id"),
    decision: text("decision").notNull(), // ALLOW, DENY
    reason: text("reason"), // Why allowed/denied
    context: jsonb("context").default({}), // { ip, userAgent, location, etc. }
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    clerkIdIdx: index("audit_logs_clerk_id_idx").on(table.clerkId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  })
);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────────────────────

export const organizationRelations = relations(organizations, ({ many }) => ({
  teams: many(teams),
}));

export const teamRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
}));

export const roleRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  members: many(teamMembers),
}));

export const rolePermissionRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
}));

export const teamMemberRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  role: one(roles, {
    fields: [teamMembers.roleId],
    references: [roles.id],
  }),
}));

export const dataTypeRelations = relations(dataTypes, ({ many }) => ({
  consents: many(userConsents),
}));

export const userConsentRelations = relations(userConsents, ({ one }) => ({
  dataType: one(dataTypes, {
    fields: [userConsents.dataTypeId],
    references: [dataTypes.id],
  }),
}));
