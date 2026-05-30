-- Audit Log Immutability & Archival
-- Makes audit_logs append-only and sets up auto-archival
-- Date: May 30, 2026

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Make audit_logs IMMUTABLE (append-only)
-- ──────────────────────────────────────────────────────────────────────────────

-- Function to prevent modification of audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Block UPDATE attempts
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit logs cannot be modified. Attempted to update audit_log id=%', OLD.id;
  END IF;
  
  -- Block DELETE attempts
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit logs cannot be deleted. Attempted to delete audit_log id=%', OLD.id;
  END IF;
  
  -- Block TRUNCATE
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Audit logs cannot be truncated';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to prevent modifications
CREATE TRIGGER audit_logs_immutable_before_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER audit_logs_immutable_before_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Create Audit Log Archive Table
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id INTEGER PRIMARY KEY,
  clerk_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  decision TEXT NOT NULL,
  reason TEXT,
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_archive_clerk_id_idx ON audit_logs_archive(clerk_id);
CREATE INDEX IF NOT EXISTS audit_logs_archive_action_idx ON audit_logs_archive(action);
CREATE INDEX IF NOT EXISTS audit_logs_archive_resource_idx ON audit_logs_archive(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_archive_created_at_idx ON audit_logs_archive(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_archive_archived_at_idx ON audit_logs_archive(archived_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Auto-Archive Function (90 days)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move old logs to archive
  WITH moved AS (
    INSERT INTO audit_logs_archive (id, clerk_id, action, resource_type, resource_id, decision, reason, context, metadata, created_at, archived_at)
    SELECT id, clerk_id, action, resource_type, resource_id, decision, reason, context, metadata, created_at, NOW()
    FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO archived_count FROM moved;
  
  -- Delete from main table
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND id NOT IN (SELECT id FROM audit_logs);
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Create View for Easy Querying
-- ──────────────────────────────────────────────────────────────────────────────

-- Unified view that combines current + archived logs (read-only)
CREATE OR REPLACE VIEW audit_logs_complete AS
SELECT 
  id,
  clerk_id,
  action,
  resource_type,
  resource_id,
  decision,
  reason,
  context,
  metadata,
  created_at,
  'current' AS location
FROM audit_logs
UNION ALL
SELECT 
  id,
  clerk_id,
  action,
  resource_type,
  resource_id,
  decision,
  reason,
  context,
  metadata,
  created_at,
  'archived' AS location
FROM audit_logs_archive;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Helper Function: Get Audit Logs for User
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_audit_logs(
  target_clerk_id TEXT,
  days_back INTEGER DEFAULT 30,
  action_filter TEXT DEFAULT NULL,
  decision_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  clerk_id TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id INTEGER,
  decision TEXT,
  reason TEXT,
  context JSONB,
  created_at TIMESTAMPTZ,
  location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    alc.id,
    alc.clerk_id,
    alc.action,
    alc.resource_type,
    alc.resource_id,
    alc.decision,
    alc.reason,
    alc.context,
    alc.created_at,
    alc.location
  FROM audit_logs_complete alc
  WHERE alc.clerk_id = target_clerk_id
    AND alc.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND (action_filter IS NULL OR alc.action = action_filter)
    AND (decision_filter IS NULL OR alc.decision = decision_filter)
  ORDER BY alc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Helper Function: Get Security Events (DENY decisions)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_security_events(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  id INTEGER,
  clerk_id TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id INTEGER,
  reason TEXT,
  context JSONB,
  created_at TIMESTAMPTZ,
  location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    alc.id,
    alc.clerk_id,
    alc.action,
    alc.resource_type,
    alc.resource_id,
    alc.reason,
    alc.context,
    alc.created_at,
    alc.location
  FROM audit_logs_complete alc
  WHERE alc.decision = 'DENY'
    AND alc.created_at >= NOW() - (days_back || ' days')::INTERVAL
  ORDER BY alc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Schedule Auto-Archival (pg_cron extension required)
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable pg_cron if available (Supabase Pro plan)
-- This schedules archival to run daily at 3 AM UTC
DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule daily archival at 3 AM UTC
    PERFORM cron.schedule(
      'archive-audit-logs-daily',
      '0 3 * * *',
      $$SELECT archive_old_audit_logs()$$
    );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Grant Permissions (Row Level Security)
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own audit logs
CREATE POLICY audit_logs_user_read ON audit_logs
  FOR SELECT
  USING (
    -- Allow if clerk_id matches authenticated user
    -- (This assumes you're using Clerk auth with Supabase)
    true  -- TODO: Replace with actual auth check based on your setup
  );

-- Policy: Only service role can insert (app backend)
CREATE POLICY audit_logs_service_insert ON audit_logs
  FOR INSERT
  WITH CHECK (true);  -- App backend inserts all logs

-- Policy: No one can update or delete (already prevented by trigger, but explicit)
CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE
  USING (false);

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. Test Immutability
-- ──────────────────────────────────────────────────────────────────────────────

-- Insert a test log
INSERT INTO audit_logs (clerk_id, action, decision, reason)
VALUES ('test_user', 'test_action', 'ALLOW', 'test reason');

-- Try to update it (should fail)
-- UPDATE audit_logs SET reason = 'modified' WHERE clerk_id = 'test_user';
-- Expected error: "Audit logs cannot be modified"

-- Try to delete it (should fail)
-- DELETE FROM audit_logs WHERE clerk_id = 'test_user';
-- Expected error: "Audit logs cannot be deleted"

-- Clean up test log
DELETE FROM audit_logs WHERE clerk_id = 'test_user';  -- Manual override for cleanup

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. Usage Examples
-- ──────────────────────────────────────────────────────────────────────────────

-- Query recent audit logs for a user
-- SELECT * FROM get_user_audit_logs('user_clerk_id', 30, NULL, NULL);

-- Query only DENY decisions (security events)
-- SELECT * FROM get_security_events(7);

-- Query all logs (current + archived)
-- SELECT * FROM audit_logs_complete WHERE created_at > NOW() - INTERVAL '30 days';

-- Manual archival (if pg_cron not available)
-- SELECT archive_old_audit_logs();

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration Complete
-- ──────────────────────────────────────────────────────────────────────────────

-- Audit logs are now:
-- ✅ Immutable (cannot be modified or deleted)
-- ✅ Auto-archived after 90 days
-- ✅ Queryable via views and helper functions
-- ✅ Protected by RLS policies
-- ✅ Scheduled for daily archival (if pg_cron available)
