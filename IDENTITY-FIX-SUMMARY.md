# User Identity Tracking Fix

## Problem

The AI was confusing different users' identities because:

- When User A said "I'm Emmanuel", it was stored as general knowledge
- When User B chatted, the AI might recall "I'm Emmanuel" and think THEY are Emmanuel
- Similarly, the AI learned "I'm Omni" about itself, causing identity confusion

This broke the fundamental understanding of "who is who" in conversations.

## Root Cause

The knowledge graph stored ALL facts equally, without distinguishing between:

1. **Universal facts** - "The sky is blue" (true for everyone)
2. **User-specific facts** - "I am Emmanuel" (only true for one user)
3. **AI self-knowledge** - "I am Omni" (the AI's identity)

## Solution

### 1. Identity Detection (`extractor.ts`)

Added detection for identity statements:

```typescript
export function detectIdentityStatement(text: string): string | null {
  // Detects: "I am X", "My name is X", "Call me X", etc.
}
```

Identity facts are now tagged with:

- `type: "identity"`
- `userIdentity: true`
- Tags include the extracted name

### 2. User-Specific Storage (`brain/index.ts`)

Identity facts are now stored with strict user attribution:

```typescript
if (fact.type === "identity" || fact.userIdentity) {
  if (!clerkId) {
    // Skip - can't store identity without user ID
    continue;
  }
  // Store with clerkId for proper attribution
  await insertNode(..., clerkId, true);
}
```

### 3. Filtered Retrieval (`brain/index.ts`)

When retrieving knowledge, identity facts are filtered by user:

```typescript
const filteredNodes = allNodes.filter((node) => {
  if (node.type === "identity") {
    // Only show identity facts for THIS user
    return node.clerkId === clerkId || node.clerkId === null;
  }
  return true;
});
```

### 4. Cleanup Script (`scripts/cleanup-identity-facts.ts`)

Removes previously confused identity facts:

```bash
cd artifacts/api-server
pnpm cleanup:identity
```

This deletes:

- Identity statements without `clerkId` (orphaned)
- Statements like "I am Omni", "I am the assistant"
- User identity facts stored in wrong context

## Files Modified

| File                                                     | Changes                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `artifacts/api-server/src/brain/extractor.ts`            | Added `detectIdentityStatement()`, identity type, `userIdentity` flag    |
| `artifacts/api-server/src/brain/index.ts`                | Updated `insertNode()`, `retrieveRelevantNodes()`, fact processing logic |
| `artifacts/api-server/src/brain/native-synthesizer.ts`   | Enhanced meta-text filtering to block AI identity statements             |
| `artifacts/api-server/package.json`                      | Added `cleanup:identity` script                                          |
| `artifacts/api-server/scripts/cleanup-identity-facts.ts` | NEW - cleanup script                                                     |
| `artifacts/api-server/scripts/README.md`                 | NEW - documentation                                                      |

## Testing

### Before Fix

```
User A: "I'm Emmanuel"
AI: "Nice to meet you, Emmanuel!"
[AI stores "I am Emmanuel" as general knowledge]

User B: "What's my name?"
AI: "You're Emmanuel!"  ❌ WRONG
```

### After Fix

```
User A (clerkId: user_123): "I'm Emmanuel"
AI: "Nice to meet you, Emmanuel!"
[AI stores "I am Emmanuel" with clerkId: user_123]

User B (clerkId: user_456): "What's my name?"
AI: "I don't know your name yet - would you like to tell me?"  ✅ CORRECT
```

## Deployment Steps

1. **Deploy the code changes:**

   ```bash
   cd artifacts/api-server
   # Code is already updated
   ```

2. **Run the cleanup script:**

   ```bash
   pnpm cleanup:identity
   ```

   Review the output - it will show what will be deleted before deleting.

3. **Restart the API server:**

   ```bash
   # On Railway, this happens automatically on deploy
   # Locally: pnpm dev
   ```

4. **Test with multiple users:**
   - User A says "I'm [Name A]"
   - User B says "I'm [Name B]"
   - Ask each user "What's my name?"
   - Each should get their own name, not mixed up

## Future Improvements

1. **User Profiles Table** - Store canonical user names separately from knowledge graph
2. **Identity Confidence Scoring** - Weight recent identity statements higher
3. **Identity Conflict Detection** - Detect when user changes their name
4. **AI Self-Identity** - Separate table for AI's own identity/knowledge

## Monitoring

Watch for these in logs:

```
INFO: Stored user identity fact { clerkId: "user_123", fact: {...} }
WARN: Skipping identity fact from anonymous user
```

If you see many "anonymous user" warnings, consider requiring auth for chat.

---

**Status:** ✅ Implemented and ready for deployment
**Breaking Changes:** None - backwards compatible
**Data Migration:** Run `pnpm cleanup:identity` once after deploy
