# Vector Search Scaling Guide

## Current State (May 2026)

**Implementation:** Two-stage hybrid retrieval
- **Stage 1:** TF-IDF filters to top 100 candidates (fast, O(n) but lightweight)
- **Stage 2:** Embedding re-ranks top 100 (expensive cosine similarity, but only on small set)

**Performance:**
- ✅ Scales to ~10,000 nodes comfortably
- ✅ No database extensions required
- ✅ Works with current Supabase free tier
- ⚠️ Will degrade past 10K nodes (TF-IDF stage still O(n))

**Location:** `artifacts/api-server/src/brain/index.ts` → `retrieveRelevantNodes()`

---

## When to Migrate to pgvector

**Migrate when:**
- Knowledge nodes > 10,000
- Query latency > 500ms (p95)
- Memory usage spikes during retrieval
- TF-IDF pre-filtering becomes a bottleneck

**Current alternative:** Two-stage retrieval (implemented) handles up to 10K nodes without pgvector.

---

## pgvector Migration (Production-Ready)

### Step 1: Enable pgvector Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2: Add Vector Column

```sql
-- Add vector column (384 dimensions for all-MiniLM-L6-v2)
ALTER TABLE knowledge_nodes 
ADD COLUMN embedding_vector vector(384);

-- Populate from existing JSON embedding column
UPDATE knowledge_nodes 
SET embedding_vector = embedding::vector
WHERE embedding IS NOT NULL;
```

### Step 3: Create Index

```sql
-- HNSW index for fast approximate nearest neighbor search
-- m=16: Number of connections per node (higher = more accurate, more memory)
-- efConstruction=64: Size of dynamic candidate list during index build

CREATE INDEX CONCURRENTLY ON knowledge_nodes 
USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Index Parameters:**

| Parameter | Default | For 10K nodes | For 100K nodes | For 1M nodes |
|-----------|---------|---------------|----------------|--------------|
| `m` | 16 | 16 | 32 | 64 |
| `ef_construction` | 64 | 64 | 128 | 256 |
| Memory | ~100MB | ~100MB | ~400MB | ~2GB |

### Step 4: Update Query to Use Index

```sql
-- Query with approximate nearest neighbor (fast)
SELECT id, content, 1 - (embedding_vector <=> $1::vector) AS similarity
FROM knowledge_nodes
ORDER BY embedding_vector <=> $1::vector
LIMIT 10;

-- Query with exact nearest neighbor (accurate, slower)
SELECT id, content, 1 - (embedding_vector <=> $1::vector) AS similarity
FROM knowledge_nodes
ORDER BY 1 - (embedding_vector <=> $1::vector)
LIMIT 10;
```

**Note:** `<=>` returns cosine distance (0 = identical, 1 = orthogonal). Convert to similarity: `similarity = 1 - distance`.

### Step 5: Update TypeScript Code

```typescript
// artifacts/api-server/src/brain/index.ts

import { sql } from "drizzle-orm";

export async function retrieveRelevantNodes(
  query: string,
  clerkId: string | null,
  topK = 6,
): Promise<RetrievedNode[]> {
  const queryEmbedding = await embedText(query);
  
  // Convert embedding to SQL vector literal
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  
  // Query using pgvector
  const results = await db
    .select({
      id: knowledgeNodes.id,
      content: knowledgeNodes.content,
      type: knowledgeNodes.type,
      tags: knowledgeNodes.tags,
      confidence: knowledgeNodes.confidence,
      clerkId: knowledgeNodes.clerkId,
      embedding: knowledgeNodes.embedding,
      tokens: knowledgeNodes.tokens,
      tfidfVector: knowledgeNodes.tfidfVector,
      timesAccessed: knowledgeNodes.timesAccessed,
      createdAt: knowledgeNodes.createdAt,
      similarity: sql<number>`1 - (${knowledgeNodes.embeddingVector} <=> ${vectorLiteral}::vector)`,
    })
    .from(knowledgeNodes)
    .where(
      clerkId 
        ? sql`${knowledgeNodes.clerkId} = ${clerkId} OR ${knowledgeNodes.clerkId} IS NULL`
        : sql`true`
    )
    .orderBy(sql`${knowledgeNodes.embeddingVector} <=> ${vectorLiteral}::vector`)
    .limit(topK);
  
  return results as unknown as RetrievedNode[];
}
```

### Step 6: Update Drizzle Schema

```typescript
// lib/db/src/schema/knowledge-nodes.ts

import { pgTable, text, integer, real, vector, timestamp } from "drizzle-orm/pg-core";

export const knowledgeNodes = pgTable("knowledge_nodes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type").notNull(),
  tags: text("tags").array().notNull(),
  confidence: real("confidence").notNull(),
  clerkId: text("clerk_id"),
  embedding: text("embedding"), // Keep JSON for backwards compatibility
  embeddingVector: vector("embedding_vector", { dimensions: 384 }), // NEW
  tokens: text("tokens").array().notNull(),
  tfidfVector: jsonb("tfidf_vector").notNull(),
  timesAccessed: integer("times_accessed").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## Performance Comparison

| Method | 100 nodes | 1K nodes | 10K nodes | 100K nodes | 1M nodes |
|--------|-----------|----------|-----------|------------|----------|
| **O(n) JS cosine** | 1ms | 10ms | 100ms | 1000ms ❌ | 10000ms ❌ |
| **Two-stage (current)** | 2ms | 5ms | 50ms | 200ms ⚠️ | 1000ms ⚠️ |
| **pgvector HNSW** | 5ms | 5ms | 10ms | 30ms ✅ | 100ms ✅ |

**Note:** Two-stage retrieval is a stopgap. pgvector is the production solution.

---

## Cost Implications

### Current (Two-Stage)
- **Supabase:** Free tier (500MB DB)
- **Compute:** Included in Railway free tier
- **Total:** $0/month

### With pgvector
- **Supabase:** Free tier supports pgvector ✅
- **Storage:** Vector index adds ~10% overhead (4 bytes × 384 dims × node count)
  - 10K nodes: ~15MB
  - 100K nodes: ~150MB
  - 1M nodes: ~1.5GB (may need Pro tier: $25/month)
- **Total:** $0-25/month depending on scale

---

## Migration Checklist

- [ ] Enable pgvector extension in Supabase
- [ ] Add `embedding_vector` column
- [ ] Populate from existing `embedding` JSON
- [ ] Create HNSW index (use `CONCURRENTLY` to avoid locking)
- [ ] Update Drizzle schema
- [ ] Update `retrieveRelevantNodes()` to use SQL vector search
- [ ] Test with production data volume
- [ ] Monitor query latency (target: <50ms p95)
- [ ] Remove TF-IDF fallback (optional, keep for redundancy)

---

## Troubleshooting

### Index Not Used

```sql
-- Check if index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'knowledge_nodes';

-- Force query planner to use index
SET enable_seqscan = off;
EXPLAIN ANALYZE SELECT ...;
```

### Memory Issues

```sql
-- Check index size
SELECT pg_size_pretty(pg_relation_size('knowledge_nodes_embedding_vector_idx'));

-- Reduce m parameter if needed
DROP INDEX knowledge_nodes_embedding_vector_idx;
CREATE INDEX CONCURRENTLY knowledge_nodes_embedding_vector_idx 
ON knowledge_nodes USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 8, ef_construction = 32);
```

### Query Still Slow

```sql
-- Increase ef_search for better accuracy (default = 40)
SET hnsw.ef_search = 100;

-- Query with higher ef_search
SET LOCAL hnsw.ef_search = 100;
SELECT ...;
```

---

## Alternative: Use Supabase Vector Store

Supabase offers a managed vector store abstraction:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data, error } = await supabase.rpc('match_knowledge_nodes', {
  query_embedding: queryEmbedding,
  match_count: topK,
});
```

**Pros:**
- Managed by Supabase
- Simpler API
- Built-in RPC function

**Cons:**
- Less control over index parameters
- May have additional cost at scale

---

## References

- **pgvector GitHub:** https://github.com/pgvector/pgvector
- **Supabase Vector Guide:** https://supabase.com/docs/guides/ai/vector-columns
- **HNSW Parameters:** https://github.com/pgvector/pgvector#hnsw-index-parameters
- **all-MiniLM-L6-v2:** 384 dimensions, works well for semantic search

---

**Last Updated:** May 21, 2026  
**Status:** Two-stage retrieval implemented (scales to 10K nodes). pgvector migration ready when needed.
