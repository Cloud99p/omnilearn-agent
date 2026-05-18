-- QUICK DELETE: Remove specific non-facts that were incorrectly learned
-- Run this in Supabase SQL Editor

-- Delete conversation fillers and non-facts
DELETE FROM knowledge_nodes
WHERE content IN (
  'i will like more details actually',
  'I will like more details actually',
  'i can help with that',
  'I can help with that',
  'yes',
  'no',
  'okay',
  'ok',
  'got it',
  'i see',
  'I see',
  'makes sense',
  'Interesting',
  'interesting',
  'Great question',
  'Good question',
  'Thats an interesting topic',
  'That''s an interesting topic',
  'Tell me more',
  'tell me more',
  'Explain what you mean',
  'explain what you mean'
)
OR (
  -- Short acknowledgments (< 20 chars) containing common filler words
  length(content) < 20 
  AND (
    content ILIKE '%yes%' 
    OR content ILIKE '%no%' 
    OR content ILIKE '%okay%' 
    OR content ILIKE '%ok%'
    OR content ILIKE '%got it%'
    OR content ILIKE '%i see%'
    OR content ILIKE '%makes sense%'
  )
);

-- Show what was deleted
SELECT 'Deleted non-facts' as action;
