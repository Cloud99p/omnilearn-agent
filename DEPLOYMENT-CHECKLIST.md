# Identity Fix - Deployment Checklist

## ✅ Changes Summary

Fixed user identity confusion by:

1. Detecting identity statements ("I'm X", "My name is X")
2. Storing them with user-specific `clerkId` attribution
3. Filtering retrieval to show only the current user's identity facts
4. Blocking AI self-identity statements ("I am Omni") from being learned

## 📋 Pre-Deployment

### 1. Run Tests

```bash
cd artifacts/api-server
pnpm tsx scripts/test-identity-detection.ts
# Should show: ✅ All tests passed!
```

### 2. Type Check

```bash
pnpm typecheck
# Ignore pre-existing errors in sentry.ts, ghost/chat.ts, etc.
# Ensure NO errors in: extractor.ts, index.ts (brain), native-synthesizer.ts
```

### 3. Review Changes

Files modified:

- `artifacts/api-server/src/brain/extractor.ts` - Identity detection
- `artifacts/api-server/src/brain/index.ts` - Storage & retrieval logic
- `artifacts/api-server/src/brain/native-synthesizer.ts` - Meta-text filtering
- `artifacts/api-server/package.json` - Added cleanup script
- `artifacts/api-server/scripts/cleanup-identity-facts.ts` - NEW cleanup script

## 🚀 Deployment Steps

### Step 1: Deploy Code

```bash
# Push to GitHub (triggers Railway deploy)
git add .
git commit -m "fix: user identity tracking with clerkId attribution"
git push
```

### Step 2: Run Cleanup Script (ONE TIME)

After deploy completes:

```bash
# SSH into Railway or run locally if you have DB access
cd artifacts/api-server
pnpm cleanup:identity
```

This will:

- Show confused identity facts that will be deleted
- Ask for confirmation
- Remove orphaned identity statements
- Report any remaining issues

**Expected output:**

```
🔍 Scanning for confused identity facts...

⚠️  Found X confused identity facts:
1. [identity] I am Emmanuel
...

🗑️  Deleting confused identity facts...

✅ Deleted X confused identity facts
```

### Step 3: Verify Deployment

Test with two different users:

**User A:**

```
User: I'm Emmanuel
AI: Nice to meet you, Emmanuel!

User: What's my name?
AI: Your name is Emmanuel.
```

**User B:**

```
User: I'm Sarah
AI: Nice to meet you, Sarah!

User: What's my name?
AI: Your name is Sarah.
```

**Cross-check (User A asks about User B's data):**

```
User A: What is Sarah's name?
AI: I don't have information about Sarah in my knowledge base.
```

## 📊 Monitoring

### Logs to Watch

```bash
# In Railway dashboard, check logs for:
INFO: Stored user identity fact { clerkId: "user_123", ... }
WARN: Skipping identity fact from anonymous user
```

### Metrics to Track

- Number of identity facts stored per user
- Cleanup script results (how many confused facts were removed)
- User reports of identity confusion (should drop to zero)

## 🔧 Troubleshooting

### Issue: Identity facts still getting mixed up

**Check:** Is `clerkId` being passed correctly?

```typescript
// In brain/index.ts, verify:
const clerkId = null; // Should extract from auth middleware
```

### Issue: Legitimate names being rejected

**Check:** Is the name in `NON_NAME_WORDS` set?

```typescript
// In extractor.ts, remove from NON_NAME_WORDS if needed
```

### Issue: Cleanup script fails

**Check:** Database connection and permissions

```bash
# Ensure DATABASE_URL is set
echo $DATABASE_URL
```

## 📝 Post-Deployment

### Update Documentation

- [ ] Add note to USER.md about identity tracking
- [ ] Update OmniLearn README with new feature

### Monitor for 48 Hours

- [ ] Check logs for identity-related warnings
- [ ] Ask users if they notice improved identity handling
- [ ] Verify no new confused identity facts are being created

## 🎯 Success Criteria

✅ Users report no more identity confusion
✅ Each user's name stays consistent across sessions
✅ AI doesn't claim to be different users
✅ Cleanup script removes all orphaned identity facts

---

**Deploy Date:** ******\_\_\_******
**Deployed By:** ******\_\_\_******
**Cleanup Completed:** [ ] Yes [ ] No
**Notes:** ******\_\_\_******
