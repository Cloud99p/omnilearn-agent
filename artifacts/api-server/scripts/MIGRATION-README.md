# Knowledge Nodes Migration Guide

**Goal:** Delete all ~270 knowledge nodes without embeddings and re-ingest them with proper vector embeddings.

**Why:** The existing nodes were created before the embeddings system was added. This migration ensures all nodes have vector embeddings for hybrid TF-IDF + semantic search.

---

## ⚠️ Prerequisites

1. **DATABASE_URL** must be set in your environment
2. **ANTHROPIC_API_KEY** or local synthesizer must be working (for embedding generation)
3. **Backup first!** — Run the backup script before deletion

---

## Step 1: Backup Existing Nodes

### Option A: TypeScript Script (Recommended)

```bash
cd artifacts/api-server
pnpm tsx scripts/backup-knowledge-nodes.ts
```

This creates two files:

- `knowledge-nodes-backup-<timestamp>.json` — Full backup of all nodes
- `nodes-to-reingest-<timestamp>.json` — Only nodes without embeddings

### Option B: SQL (Supabase Dashboard)

1. Go to Supabase Dashboard → Database → SQL Editor
2. Run the SQL from `scripts/backup-and-delete-nodes.sql`
3. Copy the JSON result and save it locally

---

## Step 2: Delete Nodes Without Embeddings

### Option A: TypeScript Script

```bash
cd artifacts/api-server
pnpm tsx scripts/delete-nodes-without-embeddings.ts
```

This deletes all nodes where `embedding IS NULL` or `embedding = []`.

### Option B: SQL (Supabase Dashboard)

```sql
-- Count first
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE embedding IS NULL OR jsonb_array_length(embedding) = 0) as without_embeddings
FROM knowledge_nodes;

-- Delete
DELETE FROM knowledge_nodes
WHERE embedding IS NULL
   OR jsonb_array_length(embedding) = 0;
```

---

## Step 3: Re-ingest Nodes with Embeddings

```bash
cd artifacts/api-server
pnpm tsx scripts/reingest-knowledge-nodes.ts ../knowledge-nodes-backup-<timestamp>.json
```

**Note:** This processes nodes in batches of 10 to avoid overwhelming the embedding model. Expect ~1-2 seconds per node on first run (embedding model loads on first use).

---

## Step 4: Verify

```bash
# Check via SQL in Supabase Dashboard
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL AND jsonb_array_length(embedding) > 0) as with_embeddings
FROM knowledge_nodes;
```

All nodes should now have embeddings.

---

## Document Upload Section (Temporarily Disabled)

The document upload UI has been commented out in `artifacts/omnilearn/src/pages/intelligence.tsx` until the backend upload issue is resolved.

**What was disabled:**

- File upload button in Training tab
- `selectedFile` and `fileContent` state variables
- Document source type selector
- FormData upload logic

**What still works:**

- ✅ Manual text paste
- ✅ Web URL fetch
- ✅ Research mode (multiple URLs)

**To re-enable later:**

1. Uncomment the document button in the source selector
2. Uncomment the `trainSource === "document"` conditional block
3. Uncomment `selectedFile` and `fileContent` state
4. Uncomment the file upload validation and FormData logic
5. Fix the backend `/api/omni/train` endpoint to handle multer uploads

---

## Troubleshooting

### Embedding model fails to load

- First run downloads the model (~80MB). Ensure internet connection.
- Check console for `@xenova/transformers` errors.
- Try running with `DEBUG=*` for verbose logging.

### Database connection fails

- Verify `DATABASE_URL` in Railway dashboard matches Supabase connection string.
- Ensure Supabase project is active and not paused.

### Re-ingestion is slow

- This is normal. Embedding generation is CPU-intensive.
- Model loads on first use (~10-20 seconds), then ~1-2 sec per node.
- Let it run — batches of 10 nodes at a time.

---

## Files Created

- `scripts/backup-knowledge-nodes.ts` — Backup all nodes to JSON
- `scripts/delete-nodes-without-embeddings.ts` — Delete nodes without embeddings
- `scripts/reingest-knowledge-nodes.ts` — Re-add nodes with embeddings
- `scripts/backup-and-delete-nodes.sql` — SQL alternative for backup + delete

---

**Estimated Time:** 10-15 minutes for 270 nodes (most time spent on embedding generation)
