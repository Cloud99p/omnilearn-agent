-- Delete non-factual learned content
-- Run this in Supabase SQL Editor
-- This removes conversation fillers, acknowledgments, and requests that shouldn't be learned

-- First, let's see what we're deleting (preview)
SELECT id, content, type, tags, created_at
FROM knowledge_nodes
WHERE 
  -- Acknowledgments
  content ILIKE '%yes%' AND length(content) < 20
  OR content ILIKE '%no%' AND length(content) < 20
  OR content ILIKE '%okay%' AND length(content) < 20
  OR content ILIKE '%ok%' AND length(content) < 20
  OR content ILIKE '%got it%'
  OR content ILIKE '%i see%'
  OR content ILIKE '%makes sense%'
  OR content ILIKE '%interesting%'
  -- Requests for more info
  OR content ILIKE '%more details%'
  OR content ILIKE '%more info%'
  OR content ILIKE '%explain%'
  OR content ILIKE '%tell me%'
  OR content ILIKE '%i will like%'
  OR content ILIKE '%i would like%'
  -- Meta-text
  OR content ILIKE '%i can help with that%'
  OR content ILIKE '%great question%'
  OR content ILIKE '%good question%'
  OR content ILIKE '%thats an interesting topic%'
ORDER BY created_at DESC
LIMIT 50;

-- AFTER REVIEWING, UNCOMMENT THE DELETE BELOW:

-- DELETE FROM knowledge_nodes
-- WHERE 
--   -- Acknowledgments (short, generic responses)
--   (content ILIKE '%yes%' AND length(content) < 20)
--   OR (content ILIKE '%no%' AND length(content) < 20)
--   OR (content ILIKE '%okay%' AND length(content) < 20)
--   OR (content ILIKE '%ok%' AND length(content) < 20)
--   OR content ILIKE '%got it%'
--   OR content ILIKE '%i see%'
--   OR content ILIKE '%makes sense%'
--   OR content ILIKE '%interesting%'
--   -- Requests for more info
--   OR content ILIKE '%more details%'
--   OR content ILIKE '%more info%'
--   OR content ILIKE '%explain%'
--   OR content ILIKE '%tell me%'
--   OR content ILIKE '%i will like%'
--   OR content ILIKE '%i would like%'
--   -- Meta-text
--   OR content ILIKE '%i can help with that%'
--   OR content ILIKE '%great question%'
--   OR content ILIKE '%good question%'
--   OR content ILIKE '%thats an interesting topic%'
--   -- Ensure we don't delete real facts (must be short or contain these patterns)
--   AND (length(content) < 50 OR tags @> ARRAY['conversation']);
