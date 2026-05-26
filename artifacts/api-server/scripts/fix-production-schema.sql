-- ============================================================================
-- PRODUCTION SCHEMA FIX - Run in Supabase SQL Editor
-- ============================================================================
-- This adds missing columns that the code expects but don't exist in production
-- Run this BEFORE redeploying the application
-- ============================================================================

-- Add missing column to network_neurons
ALTER TABLE network_neurons 
ADD COLUMN IF NOT EXISTS is_ratified BOOLEAN DEFAULT false;

-- Add missing columns to network_agents
ALTER TABLE network_agents 
ADD COLUMN IF NOT EXISTS endpoint TEXT,
ADD COLUMN IF NOT EXISTS trust_score DECIMAL(5,4) DEFAULT 0.5000;

-- Add missing columns to network_pulses
ALTER TABLE network_pulses 
ADD COLUMN IF NOT EXISTS agent_name TEXT,
ADD COLUMN IF NOT EXISTS event_type TEXT;

-- Verify columns were added
SELECT 
  'network_neurons' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'network_neurons'
  AND column_name IN ('is_ratified')

UNION ALL

SELECT 
  'network_agents' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'network_agents'
  AND column_name IN ('endpoint', 'trust_score')

UNION ALL

SELECT 
  'network_pulses' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'network_pulses'
  AND column_name IN ('agent_name', 'event_type');

-- ============================================================================
-- After running this:
-- 1. Verify all columns appear in the results above
-- 2. Redeploy the application on Railway
-- 3. Monitor logs for remaining errors
-- ============================================================================
