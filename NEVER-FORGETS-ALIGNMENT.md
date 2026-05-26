# "Never Forgets" Principle — Alignment Guide

**Date:** 2026-05-26  
**Purpose:** Ensure all brain improvements align with OmniLearn's core principle of permanent knowledge retention

---

## The "Never Forgets" Principle

> "Unlike traditional chatbots that reset after each session, OmniLearn **permanently retains knowledge** in a structured knowledge graph."

This is a **core identity feature** of OmniLearn, not just a technical detail. It means:

1. **No knowledge deletion** — Once learned, facts persist indefinitely
2. **No expiration** — Knowledge doesn't "age out" or get automatically pruned
3. **No session resets** — All conversations contribute to permanent memory
4. **Accumulative growth** — The knowledge graph only grows (or stays stable), never shrinks

---

## Proposed Improvements — Alignment Analysis

### 1. Document Chunking ✅ ALIGNED

**What it does:** Splits long documents into 400-token chunks with 80-token overlap

**Alignment:** ✅ **FULLY ALIGNED** — Actually *strengthens* "never forgets"

**Why:**
- All content is still stored permanently
- Chunks are **more retrievable** than full documents
- Better precision = knowledge is *less likely to be forgotten* (in the retrieval sense)
- Parent document reference maintains context

**Implementation Note:**
```typescript
// Each chunk is a permanent node
await db.insert(knowledgeNodes).values({
  content: chunk.content,
  parentDocumentId: originalDocId,  // Link to source
  startOffset: chunk.startOffset,    // Preserves location
  endOffset: chunk.endOffset,
  // ... all other fields
});
```

**Risk:** None. Chunks are immutable once created.

---

### 2. MMR Re-ranking ✅ ALIGNED

**What it does:** Re-orders retrieval results for diversity (lambda=0.7)

**Alignment:** ✅ **FULLY ALIGNED** — Only affects *order*, not *storage*

**Why:**
- All knowledge nodes remain in the database
- MMR only changes which results appear first
- Low-scoring results are still retrievable (just ranked lower)
- No deletion or modification of stored knowledge

**Implementation Note:**
```typescript
// MMR re-ranks, doesn't delete
const mmrResults = maximalMarginalRelevance(queryEmbedding, candidates, 0.7, topK);
// All candidates still exist in DB, just ordered differently
```

**Risk:** None. Purely a retrieval-layer optimization.

---

### 3. Temporal Decay ⚠️ NEEDS SAFEGUARDS

**What it does:** Weights recent knowledge higher (30-day half-life)

**Alignment:** ⚠️ **PARTIALLY ALIGNED** — Requires explicit safeguards

**Concern:**
- Old knowledge becomes *less relevant* but is **not deleted**
- However, if threshold is too high, old knowledge may never be retrieved
- This could *feel* like forgetting to users

**Safeguards Required:**

#### 3.1 Lower Minimum Threshold
```typescript
// brain/index.ts

const HALF_LIFE_DAYS = 30;
const MIN_SIMILARITY = 0.15;  // Lower than default 0.2

const scored: RetrievedNode[] = tfidfScored.map((node) => {
  // ... existing scoring
  
  // ADD: Temporal decay (but don't penalize too harshly)
  const daysOld = (Date.now() - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const temporalDecay = Math.pow(0.5, daysOld / HALF_LIFE_DAYS);
  
  // SAFEGUARD: Minimum decay factor (never less than 0.5x)
  const cappedDecay = Math.max(0.5, temporalDecay);
  const finalScore = similarity * cappedDecay;
  
  return { ...node, similarity: finalScore };
});

// SAFEGUARD: Lower threshold for old knowledge
const results = scored.filter(n => n.similarity >= MIN_SIMILARITY);
```

#### 3.2 "Deep Search" Mode
```typescript
// Allow explicit retrieval of old knowledge
export async function retrieveRelevantNodes(
  query: string,
  clerkId: string | null,
  topK = 6,
  options?: {
    includeOld?: boolean;  // Disable temporal decay
    noDecay?: boolean;     // Completely disable decay
  }
) {
  const useDecay = !options?.noDecay && !options?.includeOld;
  
  // ... scoring logic
  
  if (options?.includeOld) {
    // Lower threshold for old knowledge
    MIN_SIMILARITY = 0.1;
  }
}
```

#### 3.3 User-Facing Explanation
When old knowledge is retrieved, make it clear:
```
I found this in your knowledge graph (learned 45 days ago):
"[content]"
```

**Recommendation:** 
- ✅ Implement temporal decay **with** 0.5x minimum cap
- ✅ Add `noDecay` option for explicit old-knowledge queries
- ✅ Show "learned X days ago" in responses
- ❌ Do NOT implement auto-deletion of old nodes

---

### 4. Query Caching ✅ ALIGNED

**What it does:** Caches query results for 1 hour (LRU cache, 1000 entries)

**Alignment:** ✅ **FULLY ALIGNED** — Temporary performance layer only

**Why:**
- Cache is **ephemeral** (1-hour TTL)
- Cache misses fall back to full database query
- No impact on knowledge persistence
- All knowledge still queryable

**Implementation Note:**
```typescript
// brain/cache.ts

const queryCache = new NodeCache({ 
  stdTTL: 3600,  // 1 hour max
  maxKeys: 1000  // LRU eviction
});

// Cache is purely for performance
export async function retrieveWithCache(query, clerkId, topK) {
  const cached = queryCache.get(cacheKey);
  if (cached) return cached;
  
  // Always query DB on cache miss
  const results = await retrieveRelevantNodes(query, clerkId, topK);
  queryCache.set(cacheKey, results);
  
  return results;
}
```

**Risk:** None. Cache eviction doesn't affect DB.

---

### 5. Dynamic Thresholds ✅ ALIGNED

**What it does:** Adjusts similarity threshold based on query type

**Alignment:** ✅ **FULLY ALIGNED** — Improves retrieval precision

**Why:**
- All knowledge still stored permanently
- Thresholds only affect *which* results are returned, not *what* is stored
- Lower thresholds for broad queries = *more* knowledge retrieved
- Higher thresholds for specific queries = better precision

**Implementation Note:**
```typescript
// brain/index.ts

function getDynamicThreshold(query: string, queryType: string): number {
  // Specific questions need higher precision
  if (queryType === 'question' && query.length < 50) return 0.35;
  
  // Broad exploratory queries = lower threshold (retrieve MORE)
  if (queryType === 'statement' || query.includes('tell me about')) return 0.15;
  
  // Default
  return 0.2;
}
```

**Risk:** None. Purely retrieval-layer logic.

---

### 6. Session Memory ⚠️ NEEDS CLARIFICATION

**What it does:** Persists conversation sessions as retrievable knowledge

**Alignment:** ⚠️ **DEPENDS ON IMPLEMENTATION**

**Concerns:**
- Should sessions be permanent or temporary?
- Do users expect sessions to persist forever?
- Could violate privacy if sessions never expire

**Recommended Approach:**

#### 6.1 Session Chunks Are Permanent (Like All Knowledge)
```typescript
// brain/session-memory.ts

export async function syncSessionToMemory(sessionId, messages, clerkId) {
  // Extract facts from session (not raw transcript)
  const facts = extractFactsFromSession(messages);
  
  // Store facts permanently (aligned with "never forgets")
  for (const fact of facts) {
    await insertNode(fact.content, 'session-derived', fact.tags, 0.7, `session:${sessionId}`, clerkId);
  }
  
  // Don't store raw transcript (privacy concern)
  // Store extracted knowledge only
}
```

#### 6.2 Session Metadata Is Temporary
```typescript
// Session metadata (timestamps, message counts) can expire
// But extracted knowledge is permanent
```

**Recommendation:**
- ✅ Extract and store facts permanently
- ✅ Don't store raw session transcripts
- ✅ Add user control: "Remember this conversation" toggle
- ❌ Don't auto-delete session-derived knowledge

---

## Summary Table

| Improvement | Alignment | Safeguards Needed | Risk Level |
|-------------|-----------|-------------------|------------|
| **Chunking** | ✅ Full | None | None |
| **MMR** | ✅ Full | None | None |
| **Temporal Decay** | ⚠️ Partial | 0.5x min cap, `noDecay` option | Low |
| **Query Caching** | ✅ Full | None | None |
| **Dynamic Thresholds** | ✅ Full | None | None |
| **Session Memory** | ⚠️ Depends | Extract facts only, no raw transcripts | Medium |

---

## "Never Forgets" Implementation Checklist

### Database Layer
- [ ] No auto-delete or auto-archive logic
- [ ] No TTL/expiration on knowledge nodes
- [ ] Soft delete only (if deletion needed at all)
- [ ] Audit log for any modifications

### Retrieval Layer
- [ ] Temporal decay capped at 0.5x (never fully "forgotten")
- [ ] `noDecay` option for explicit old-knowledge queries
- [ ] Lower thresholds for broad/exploratory queries
- [ ] "Deep search" mode that bypasses all optimization

### User Experience
- [ ] Show "learned X days ago" for retrieved knowledge
- [ ] Allow users to query "what did I learn about X" (all time)
- [ ] No UI that suggests knowledge expires
- [ ] Clear explanation: "Your knowledge graph grows permanently"

### Session Memory
- [ ] Extract facts, not raw transcripts
- [ ] Store facts permanently
- [ ] Optional: User toggle for "remember this conversation"
- [ ] Privacy: Allow session deletion (user-initiated only)

---

## Philosophical Alignment

The "never forgets" principle is about **user trust** and **agent identity**:

1. **Trust:** Users confide in OmniLearn knowing it won't forget
2. **Identity:** OmniLearn is defined by its accumulated knowledge
3. **Ownership:** The knowledge graph belongs to the user, not the cloud

**Key Insight:** "Never forgets" doesn't mean "always surface everything." It means:
- ✅ All knowledge is **stored permanently**
- ✅ All knowledge is **retrievable** (even if ranked lower)
- ✅ No automatic deletion or expiration
- ✅ User controls what's forgotten (not the system)

**Temporal decay is compatible** with "never forgets" as long as:
- Old knowledge is still retrievable
- Decay is capped (0.5x minimum)
- Users can explicitly query old knowledge
- The system is transparent about age

---

## Recommendations

### Phase 1 (Safe to Implement Now)
1. ✅ **Chunking** — Fully aligned, no safeguards needed
2. ✅ **MMR** — Fully aligned, no safeguards needed
3. ✅ **Dynamic Thresholds** — Fully aligned, no safeguards needed

### Phase 2 (Implement with Safeguards)
4. ⚠️ **Temporal Decay** — Implement with 0.5x cap + `noDecay` option
5. ⚠️ **Session Memory** — Extract facts only, store permanently

### Phase 3 (Optional)
6. ✅ **Query Caching** — Fully aligned, purely performance

---

## Conclusion

The proposed improvements are **compatible** with "never forgets" as long as:

1. **No automatic deletion** — Knowledge persists indefinitely
2. **Retrieval ≠ Storage** — Optimization layers don't affect persistence
3. **User control** — Users decide what to forget, not the system
4. **Transparency** — Show knowledge age, explain retrieval behavior

**Temporal decay is the only improvement that needs explicit safeguards.** With a 0.5x minimum cap and `noDecay` option, it aligns with the principle while improving retrieval quality.

---

**Next Steps:**
1. Review this document with Emmanuel
2. Confirm "never forgets" interpretation
3. Implement Phase 1 improvements
4. Add safeguards for temporal decay before Phase 2
5. Document any user-facing changes to retrieval behavior
