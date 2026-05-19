-- Cleanup: Delete knowledge nodes with citation marker garbage
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/[your-project]/sql
-- 
-- This deletes nodes created when web scraping was broken (citation markers like [a], [b], [c])
-- 
-- ⚠️  BACKUP FIRST! Run this first to see what will be deleted:
-- SELECT id, content FROM knowledge_nodes 
-- WHERE content ILIKE '%[a]%' 
--    OR content ILIKE '%[b]%' 
--    OR content ILIKE '%[c]%' 
--    OR content ILIKE '%[^0]%' 
--    OR content ILIKE '%[Open navigation]%' 
--    OR content ILIKE '%[Close navigation]%' 
--    OR content ILIKE '%[Jump to content]%' 
--    OR content ILIKE '%[Main menu]%';

-- DELETE the garbage nodes:
DELETE FROM knowledge_nodes 
WHERE content ILIKE '%[a]%' 
   OR content ILIKE '%[b]%' 
   OR content ILIKE '%[c]%' 
   OR content ILIKE '%[^0]%' 
   OR content ILIKE '%[^1]%' 
   OR content ILIKE '%[^2]%' 
   OR content ILIKE '%[^3]%' 
   OR content ILIKE '%[^4]%' 
   OR content ILIKE '%[^5]%' 
   OR content ILIKE '%[^6]%' 
   OR content ILIKE '%[^7]%' 
   OR content ILIKE '%[^8]%' 
   OR content ILIKE '%[^9]%' 
   OR content ILIKE '%[Open navigation]%' 
   OR content ILIKE '%[Close navigation]%' 
   OR content ILIKE '%[Jump to content]%' 
   OR content ILIKE '%[Main menu]%' 
   OR content ILIKE '%[x] %]%';

-- Check how many were deleted:
SELECT 'Deleted' as status, COUNT(*) as count FROM knowledge_nodes WHERE id = -1;
-- ^ This won't work, use this instead to verify:
SELECT COUNT(*) as remaining_nodes FROM knowledge_nodes;
