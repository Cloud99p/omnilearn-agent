# OpenClaw vs OmniLearn Brain: Comparative Analysis

**Date:** 2026-05-26  
**Purpose:** Identify gaps and improvements for OmniLearn based on OpenClaw's memory architecture

---

## Executive Summary

OpenClaw's memory system is significantly more sophisticated than OmniLearn's current brain implementation. Key differences:

| Aspect | OpenClaw | OmniLearn | Gap |
|--------|----------|-----------|-----|
| **Hybrid Search** | Vector (70%) + FTS (30%) + MMR | Embedding (80%) + TF-IDF (20%) | Moderate |
| **Chunking** | 400 tokens, 80 overlap, UTF-8 aware | Full documents only | **Major** |
| **Temporal Decay** | Yes (30-day half-life) | No | Moderate |
| **Cache** | LRU cache for queries | No | Minor |
| **Multimodal** | Images, audio, video embeddings | Text only (OCR via tesseract) | **Major** |
| **Session Memory** | Experimental session-aware retrieval | Conversation history (10 messages) | Moderate |
| **Fallback Providers** | Auto-fallback on embedding failure | Single provider | Minor |
| **Batch Embeddings** | Remote batching with polling | Local embeddings only | Minor |

---

## Architecture Comparison

### OpenClaw Memory Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Query Processing                         │
│  - Query expansion                                          │
│  - Temporal decay weighting                                 │
│  - MMR (Maximal Marginal Relevance) for diversity          │
│  - Hybrid scoring (vector 70% + FTS 30%)                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Embedding Layer                          │
│  - Primary: Gemini/gemini-embedding-001 (auto)             │
│  - Fallback: Configurable alternate provider               │
│  - Remote batching with polling                            │
│  - Local model support (modelPath)                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│  - SQLite with vector extension                             │
│  - FTS5 full-text search                                    │
│  - Chunked documents (400 tokens, 80 overlap)              │
│  - LRU query cache                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Sync Layer                               │
│  - Watch mode (debounced 1500ms)                           │
│  - Session delta sync (100KB / 50 messages)                │
│  - Interval-based sync (configurable)                      │
│  - Post-compaction force sync                              │
└─────────────────────────────────────────────────────────────┘
```

### OmniLearn Brain Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Query Processing                         │
│  - Context-aware query building (10 messages)              │
│  - Fixed similarity threshold (0.2)                        │
│  - No diversity re-ranking                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Embedding Layer                          │
│  - Single provider (configurable)                          │
│  - Local embeddings only                                   │
│  - No fallback                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│  - PostgreSQL (Supabase)                                    │
│  - TF-IDF vectors (sparse)                                 │
│  - Embedding vectors (dense)                               │
│  - Full documents (no chunking)                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Character Layer                          │
│  - 7 personality traits (curiosity, caution, etc.)         │
│  - Hebbian learning for edge weights                       │
│  - Ontology self-reflection (10-min intervals)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Differences

### 1. **Chunking Strategy** ⚠️ MAJOR GAP

**OpenClaw:**
- Documents split into 400-token chunks with 80-token overlap
- UTF-8 byte-aware splitting
- Each chunk indexed separately with metadata
- Better retrieval precision for long documents

**OmniLearn:**
- Stores full documents as single nodes
- No chunking or overlap
- Long documents dilute relevance scores
- Can't retrieve specific sections

**Impact:** OpenClaw retrieves relevant sections from long documents; OmniLearn retrieves entire documents or misses content.

**Fix Priority:** HIGH

---

### 2. **Hybrid Search Weights** ⚠️ MODERATE GAP

**OpenClaw:**
- Vector: 70%, FTS: 30% (configurable)
- Normalized weights sum to 1.0
- MMR for diversity (lambda=0.7)
- Temporal decay (30-day half-life)

**OmniLearn:**
- Embedding: 80%, TF-IDF: 20% (hardcoded)
- No MMR or diversity re-ranking
- No temporal decay
- Fixed threshold (0.2)

**Impact:** OpenClaw adapts to query types better; OmniLearn has rigid scoring.

**Fix Priority:** MEDIUM

---

### 3. **Multimodal Support** ⚠️ MAJOR GAP

**OpenClaw:**
- Images, audio, video embeddings
- Configurable modalities
- Max file size limits
- Multimodal providers (Gemini supports images)

**OmniLearn:**
- Text only
- OCR via tesseract.js (basic)
- No audio/video processing
- No image embeddings

**Impact:** OpenClaw can search image/audio content; OmniLearn cannot.

**Fix Priority:** HIGH (if multimodal is needed)

---

### 4. **Query Caching** ⚠️ MINOR GAP

**OpenClaw:**
- LRU cache for query results
- Configurable max entries
- Reduces embedding API calls

**OmniLearn:**
- No query caching
- Every query generates new embeddings

**Impact:** OpenClaw is faster for repeated queries; OmniLearn wastes compute.

**Fix Priority:** LOW

---

### 5. **Session Memory** ⚠️ MODERATE GAP

**OpenClaw:**
- Experimental session-aware retrieval
- Delta sync (100KB / 50 messages)
- Session chunks indexed separately
- Can search across sessions

**OmniLearn:**
- Uses last 10 messages for context
- No session persistence
- No cross-session retrieval

**Impact:** OpenClaw has long-term session memory; OmniLearn loses context after conversation ends.

**Fix Priority:** MEDIUM

---

### 6. **Embedding Fallback** ⚠️ MINOR GAP

**OpenClaw:**
- Primary + fallback providers
- Auto-switches on failure
- Batch embeddings with polling
- API key rotation

**OmniLearn:**
- Single provider
- No fallback
- Local embeddings only

**Impact:** OpenClaw is more resilient; OmniLearn fails if provider is down.

**Fix Priority:** LOW

---

### 7. **Temporal Decay** ⚠️ MODERATE GAP

**OpenClaw:**
- Recent chunks weighted higher
- 30-day half-life (configurable)
- Exponential decay function

**OmniLearn:**
- No temporal weighting
- Old and new knowledge treated equally

**Impact:** OpenClaw prioritizes recent knowledge; OmniLearn may surface outdated info.

**Fix Priority:** MEDIUM

---

### 8. **Character/Personality Layer** ✅ OMNILEARN ADVANTAGE

**OpenClaw:**
- No personality system
- Stateless retrieval

**OmniLearn:**
- 7 evolving personality traits
- Hebbian learning for knowledge edges
- Ontology self-reflection
- Character evolution tracking

**Impact:** OmniLearn has richer agent personality; OpenClaw is purely retrieval-focused.

**Fix Priority:** N/A (OmniLearn strength)

---

## Recommended Improvements for OmniLearn

### Phase 1: Critical (Week 1-2)

#### 1.1 Add Document Chunking

```typescript
// brain/chunker.ts

const DEFAULT_CHUNK_TOKENS = 400;
const DEFAULT_CHUNK_OVERLAP = 80;

export function chunkDocument(text: string, options?: {
  chunkTokens?: number;
  overlapTokens?: number;
}): Array<{ content: string; startOffset: number; endOffset: number }> {
  const chunkTokens = options?.chunkTokens ?? DEFAULT_CHUNK_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_CHUNK_OVERLAP;
  
  // Split into sentences first
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  const chunks: Array<{ content: string; startOffset: number; endOffset: number }> = [];
  let currentChunk = '';
  let currentTokens = 0;
  let startOffset = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = sentence.split(/\s+/).length;
    
    if (currentTokens + sentenceTokens > chunkTokens && currentChunk) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        startOffset,
        endOffset: startOffset + currentChunk.length,
      });
      
      // Keep overlap for next chunk
      const overlapSentences = currentChunk.split(/(?<=[.!?])\s+/).slice(-Math.ceil(overlapTokens / 10));
      currentChunk = overlapSentences.join(' ');
      currentTokens = overlapSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
      startOffset = text.indexOf(currentChunk, startOffset);
    }
    
    currentChunk += (currentChunk ? ' ' : '') + sentence;
    currentTokens += sentenceTokens;
  }
  
  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      startOffset,
      endOffset: startOffset + currentChunk.length,
    });
  }
  
  return chunks;
}
```

**Usage:**
```typescript
// brain/index.ts - insertNode

async function insertNode(content: string, ...) {
  // Chunk long documents
  const chunks = chunkDocument(content, { 
    chunkTokens: 400, 
    overlapTokens: 80 
  });
  
  // Insert each chunk as separate node with parent reference
  for (const chunk of chunks) {
    await db.insert(knowledgeNodes).values({
      content: chunk.content,
      parentDocumentId: originalDocId,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      // ... other fields
    });
  }
}
```

---

#### 1.2 Add MMR Re-ranking

```typescript
// brain/mmr.ts

export function maximalMarginalRelevance(
  queryEmbedding: number[],
  candidates: RetrievedNode[],
  lambda: number = 0.7,
  topK: number = 6
): RetrievedNode[] {
  const selected: RetrievedNode[] = [];
  const remaining = [...candidates];
  
  while (selected.length < topK && remaining.length > 0) {
    // Score each candidate
    const scored = remaining.map(candidate => {
      // Similarity to query
      const querySimilarity = cosineSimilarity(queryEmbedding, candidate.embedding);
      
      // Similarity to already selected (for diversity)
      const maxSelectedSimilarity = selected.length === 0 
        ? 0 
        : Math.max(...selected.map(s => cosineSimilarity(candidate.embedding, s.embedding)));
      
      // MMR score
      const mmrScore = lambda * querySimilarity - (1 - lambda) * maxSelectedSimilarity;
      
      return { candidate, mmrScore };
    });
    
    // Pick highest MMR score
    scored.sort((a, b) => b.mmrScore - a.mmrScore);
    const best = scored[0];
    
    selected.push(best.candidate);
    remaining.splice(remaining.indexOf(best.candidate), 1);
  }
  
  return selected;
}
```

**Usage:**
```typescript
// brain/index.ts - retrieveRelevantNodes

// After hybrid scoring, apply MMR
const mmrResults = maximalMarginalRelevance(queryEmbedding, scored, 0.7, topK);
return mmrResults;
```

---

### Phase 2: Important (Week 3-4)

#### 2.1 Add Temporal Decay

```typescript
// brain/index.ts - scored mapping

const HALF_LIFE_DAYS = 30;

const scored: RetrievedNode[] = tfidfScored.map((node) => {
  // ... existing embedding + TF-IDF scoring
  
  // ADD: Temporal decay
  const daysOld = (Date.now() - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const temporalDecay = Math.pow(0.5, daysOld / HALF_LIFE_DAYS);
  const finalScore = similarity * temporalDecay;
  
  return { ...node, similarity: finalScore };
});
```

---

#### 2.2 Add Query Caching

```typescript
// brain/cache.ts

import NodeCache from 'node-cache';

const queryCache = new NodeCache({ 
  stdTTL: 3600, // 1 hour
  maxKeys: 1000 
});

export async function retrieveWithCache(
  query: string,
  clerkId: string | null,
  topK: number
): Promise<RetrievedNode[]> {
  const cacheKey = `query:${query}:${clerkId}:${topK}`;
  
  const cached = queryCache.get<RetrievedNode[]>(cacheKey);
  if (cached) return cached;
  
  const results = await retrieveRelevantNodes(query, clerkId, topK);
  queryCache.set(cacheKey, results);
  
  return results;
}
```

---

#### 2.3 Add Dynamic Thresholds

```typescript
// brain/index.ts

function getDynamicThreshold(query: string, queryType: string): number {
  // Specific questions need higher precision
  if (queryType === 'question' && query.length < 50) return 0.35;
  
  // Broad exploratory queries can be more lenient
  if (queryType === 'statement' || query.includes('tell me about')) return 0.15;
  
  // Technical queries need high precision
  if (/\b(how|what|why|when|where)\b/i.test(query)) return 0.3;
  
  // Default
  return 0.2;
}
```

---

### Phase 3: Nice to Have (Month 2)

#### 3.1 Add Multimodal Support

```typescript
// brain/multimodal-tools.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function embedImage(imagePath: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  
  const result = await model.embedContent({
    contents: [{
      parts: [{
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64
        }
      }]
    }]
  });
  
  return result.embedding.values;
}
```

---

#### 3.2 Add Session Memory

```typescript
// brain/session-memory.ts

export async function syncSessionToMemory(
  sessionId: string,
  messages: Array<{ role: string; content: string }>,
  clerkId: string
) {
  // Chunk session into 100KB segments
  const chunks = chunkSession(messages, 100000);
  
  for (const chunk of chunks) {
    await insertNode(chunk.content, 'session', chunk.tags, 0.7, `session:${sessionId}`, clerkId);
  }
}
```

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **P0** | Document chunking | Medium | High |
| **P0** | MMR re-ranking | Low | High |
| **P1** | Temporal decay | Low | Medium |
| **P1** | Dynamic thresholds | Low | Medium |
| **P2** | Query caching | Low | Low |
| **P2** | Session memory | Medium | Medium |
| **P3** | Multimodal embeddings | High | High (if needed) |

---

## Summary

**OmniLearn strengths:**
- Character personality system (unique)
- Hebbian learning for knowledge edges
- Ontology self-reflection
- 7-tier mesh network architecture

**OpenClaw strengths:**
- Sophisticated chunking strategy
- MMR for diverse results
- Temporal decay for recency
- Query caching for performance
- Multimodal support
- Fallback providers for resilience

**Recommendation:** Implement Phase 1 (chunking + MMR) immediately for biggest impact. Phase 2 improvements are lower effort with moderate gains. Phase 3 depends on whether multimodal/session features are needed.

---

**Next Steps:**
1. Create `chunker.ts` and `mmr.ts` modules
2. Update `insertNode()` to chunk long documents
3. Apply MMR re-ranking in `retrieveRelevantNodes()`
4. Test with long documents and diverse queries
5. Monitor retrieval quality improvements
