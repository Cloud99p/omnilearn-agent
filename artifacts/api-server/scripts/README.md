# API Server Scripts

Utility scripts for maintenance and data management.

## Cleanup Scripts

### Identity Facts Cleanup

**Problem:** The AI was learning identity statements ("I am X", "My name is Y") from all users and storing them as general knowledge. This caused confusion when different users chatted with the AI - it would mix up who said what.

**Solution:**

1. Identity facts are now detected and tagged with `type: "identity"`
2. They are stored with the user's `clerkId` for proper attribution
3. Retrieval filters identity facts to only show those belonging to the current user

**Run cleanup:**

```bash
cd artifacts/api-server
pnpm cleanup:identity
```

This will:

- Scan all knowledge nodes for confused identity facts
- Show you what will be deleted
- Remove identity facts that were stored without proper user attribution
- Report any remaining orphaned identity nodes

**What gets deleted:**

- Identity statements without `clerkId` (orphaned)
- Statements matching patterns like "I am Omni", "I am the assistant", etc.
- User identity facts stored as general knowledge (e.g., "I am Emmanuel" from wrong context)

**After cleanup:**

- New identity statements will be properly attributed to users
- Each user will only see their own identity facts in responses
- The AI will no longer confuse different users' identities

---

## Other Scripts

(None yet - add maintenance scripts here as needed)
