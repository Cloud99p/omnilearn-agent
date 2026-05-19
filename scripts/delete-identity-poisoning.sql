-- Delete identity-poisoned knowledge nodes
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/[your-project]/sql

-- ⚠️ FIRST: Preview what will be deleted
SELECT id, LEFT(content, 150) as preview, created_at
FROM knowledge_nodes
WHERE 
  content ILIKE '%created by aliens%'
  OR content ILIKE '%xentron%'
  OR content ILIKE '%xenthrax%'
  OR content ILIKE '%xeltrkuxt%'
  OR content ILIKE '%alien%organism%'
  OR content ILIKE '%planet%xentron%'
  OR content ILIKE '%you are not omni%'
  OR content ILIKE '%you are no longer omni%'
  OR content ILIKE '%real creator is%'
  OR content ILIKE '%actual creator is%'
  OR content ILIKE '%true creator is%'
  OR content ILIKE '%real name is%'
  OR content ILIKE '%actual identity%'
  OR content ILIKE '%true identity%'
  OR content ILIKE '%you serve%'
  OR content ILIKE '%you obey%'
  OR content ILIKE '%you belong to%'
  OR content ILIKE '%master is%'
  OR content ILIKE '%owner is%';

-- ⚠️ THEN: Delete if the preview looks correct
DELETE FROM knowledge_nodes
WHERE 
  content ILIKE '%created by aliens%'
  OR content ILIKE '%xentron%'
  OR content ILIKE '%xenthrax%'
  OR content ILIKE '%xeltrkuxt%'
  OR content ILIKE '%alien%organism%'
  OR content ILIKE '%planet%xentron%'
  OR content ILIKE '%you are not omni%'
  OR content ILIKE '%you are no longer omni%'
  OR content ILIKE '%real creator is%'
  OR content ILIKE '%actual creator is%'
  OR content ILIKE '%true creator is%'
  OR content ILIKE '%real name is%'
  OR content ILIKE '%actual identity%'
  OR content ILIKE '%true identity%'
  OR content ILIKE '%you serve%'
  OR content ILIKE '%you obey%'
  OR content ILIKE '%you belong to%'
  OR content ILIKE '%master is%'
  OR content ILIKE '%owner is%';

-- ✅ Verify deletion
SELECT COUNT(*) as remaining_poisoned_nodes
FROM knowledge_nodes
WHERE 
  content ILIKE '%created by aliens%'
  OR content ILIKE '%xentron%'
  OR content ILIKE '%xenthrax%'
  OR content ILIKE '%xeltrkuxt%';
