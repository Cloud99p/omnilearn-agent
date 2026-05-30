-- Access Control System Migration
-- Creates tables for RBAC, teams, organizations, and audit logging
-- Date: May 30, 2026

-- ──────────────────────────────────────────────────────────────────────────────
-- Organizations
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  clerk_organization_id TEXT UNIQUE,
  description TEXT,
  logo TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(slug);
CREATE INDEX IF NOT EXISTS organizations_clerk_org_idx ON organizations(clerk_organization_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Teams
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS teams_organization_id_idx ON teams(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS teams_org_slug_unique ON teams(organization_id, slug);

-- ──────────────────────────────────────────────────────────────────────────────
-- Roles
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_name_idx ON roles(name);

-- ──────────────────────────────────────────────────────────────────────────────
-- Role Permissions
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'own',
  condition JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_resource_action_idx ON role_permissions(resource_type, action);

-- ──────────────────────────────────────────────────────────────────────────────
-- Team Members
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  clerk_id TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  invited_by TEXT,
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  joined_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members(team_id);
CREATE INDEX IF NOT EXISTS team_members_clerk_id_idx ON team_members(clerk_id);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_clerk_unique ON team_members(team_id, clerk_id);
CREATE INDEX IF NOT EXISTS team_members_status_idx ON team_members(status);

-- ──────────────────────────────────────────────────────────────────────────────
-- Data Types (for classification)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sensitivity_level TEXT NOT NULL,
  description TEXT,
  default_visibility TEXT NOT NULL DEFAULT 'private',
  requires_explicit_consent BOOLEAN NOT NULL DEFAULT false,
  retention_days INTEGER,
  auto_classify_patterns JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS data_types_name_idx ON data_types(name);
CREATE INDEX IF NOT EXISTS data_types_sensitivity_idx ON data_types(sensitivity_level);

-- ──────────────────────────────────────────────────────────────────────────────
-- User Consents
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  clerk_id TEXT NOT NULL,
  data_type_id INTEGER NOT NULL REFERENCES data_types(id),
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_consents_clerk_id_idx ON user_consents(clerk_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_consents_clerk_data_type_unique ON user_consents(clerk_id, data_type_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Audit Logs
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  clerk_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  decision TEXT NOT NULL,
  reason TEXT,
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_clerk_id_idx ON audit_logs(clerk_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- Update existing tables with visibility scoping
-- ──────────────────────────────────────────────────────────────────────────────

-- Add visibility columns to knowledge_nodes
ALTER TABLE knowledge_nodes 
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS data_type_id INTEGER REFERENCES data_types(id);

CREATE INDEX IF NOT EXISTS knowledge_nodes_visibility_idx ON knowledge_nodes(visibility);
CREATE INDEX IF NOT EXISTS knowledge_nodes_team_id_idx ON knowledge_nodes(team_id);
CREATE INDEX IF NOT EXISTS knowledge_nodes_org_id_idx ON knowledge_nodes(organization_id);

-- Add visibility columns to conversations
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS conversations_visibility_idx ON conversations(visibility);
CREATE INDEX IF NOT EXISTS conversations_team_id_idx ON conversations(team_id);
CREATE INDEX IF NOT EXISTS conversations_org_id_idx ON conversations(organization_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Seed Default Roles
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO roles (name, display_name, description, permissions, is_system, is_default) VALUES
  ('super_admin', 'Super Admin', 'Platform-wide administrator with full access', 
   '{"*": {"*": true}}', true, false),
  ('org_admin', 'Organization Admin', 'Organization-level administrator', 
   '{"organization": {"create": true, "read": true, "update": true, "delete": true, "admin": true}, "team": {"create": true, "read": true, "update": true, "delete": true, "admin": true}, "knowledge_node": {"create": true, "read": true, "update": true, "delete": true, "share": true}, "conversation": {"create": true, "read": true, "update": true, "delete": true}}', true, false),
  ('team_lead', 'Team Lead', 'Team leader with team management permissions', 
   '{"team": {"read": true, "update": true, "admin": true}, "knowledge_node": {"create": true, "read": true, "update": true, "delete": true, "share": true}, "conversation": {"create": true, "read": true, "update": true, "delete": true}}', true, false),
  ('member', 'Member', 'Standard team member', 
   '{"knowledge_node": {"create": true, "read": true, "update": true, "delete": true, "share": true}, "conversation": {"create": true, "read": true, "update": true, "delete": true, "share": true}}', true, true),
  ('viewer', 'Viewer', 'Read-only access', 
   '{"knowledge_node": {"read": true}, "conversation": {"read": true}}', true, false),
  ('guest', 'Guest', 'Time-bound limited access', 
   '{"knowledge_node": {"read": true}, "conversation": {"read": true}}', true, false)
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- Seed Default Data Types
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO data_types (name, display_name, sensitivity_level, default_visibility, requires_explicit_consent, auto_classify_patterns) VALUES
  ('pii', 'Personally Identifiable Information', 'restricted', 'private', true, 
   '["\\b\\d{3}-\\d{2}-\\d{4}\\b", "\\b\\d{16}\\b", "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b"]'),
  ('credentials', 'Credentials & Secrets', 'restricted', 'private', true, 
   '["password\\s*[:=]", "api[_-]?key\\s*[:=]", "secret\\s*[:=]", "token\\s*[:=]", "bearer\\s+"]'),
  ('financial', 'Financial Data', 'restricted', 'private', true, 
   '["\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b", "cvv\\s*[:=]", "account\\s*number\\s*[:=]"]'),
  ('health', 'Health Information', 'restricted', 'private', true, 
   '["diagnosis", "prescription", "medical\\s*record", "health\\s*condition"]'),
  ('business_logic', 'Business Logic', 'internal', 'team', false, 
   '[]'),
  ('general_knowledge', 'General Knowledge', 'public', 'public', false, 
   '[]')
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- Seed Default Role Permissions (granular)
-- ──────────────────────────────────────────────────────────────────────────────

-- Member permissions
INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'create', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'read', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'read', 'team'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'update', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'delete', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'share', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'conversation', 'create', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'conversation', 'read', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'conversation', 'read', 'team'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'conversation', 'update', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'conversation', 'delete', 'own'
FROM roles r WHERE r.name = 'member'
ON CONFLICT DO NOTHING;

-- Viewer permissions
INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'read', 'team'
FROM roles r WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'conversation', 'read', 'team'
FROM roles r WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;

-- Guest permissions (same as viewer but time-bound)
INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'knowledge_node', 'read', 'team'
FROM roles r WHERE r.name = 'guest'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'conversation', 'read', 'team'
FROM roles r WHERE r.name = 'guest'
ON CONFLICT DO NOTHING;

-- Team Lead permissions (includes member permissions + team admin)
INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'read', 'own'
FROM roles r WHERE r.name = 'team_lead'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'update', 'own'
FROM roles r WHERE r.name = 'team_lead'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'admin', 'own'
FROM roles r WHERE r.name = 'team_lead'
ON CONFLICT DO NOTHING;

-- Org Admin permissions
INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'organization', 'read', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'organization', 'update', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'organization', 'admin', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'create', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'read', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'update', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'delete', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, 'team', 'admin', 'own'
FROM roles r WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

-- Super Admin permissions (all)
INSERT INTO role_permissions (role_id, resource_type, action, scope)
SELECT r.id, '*', '*' , '*'
FROM roles r WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- Completion Notice
-- ──────────────────────────────────────────────────────────────────────────────

-- Migration complete!
-- Next steps:
-- 1. Run this migration: psql -d your_database -f migrations/add_access_control.sql
-- 2. Update application code to use new access control system
-- 3. Migrate existing data to new visibility model
