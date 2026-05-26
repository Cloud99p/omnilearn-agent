# AI Improvements Roadmap for OmniLearn

Beyond fact extraction, here are all the areas where AI can dramatically improve efficiency and quality.

---

## Priority Matrix

| Feature | Impact | Cost | Complexity | Priority |
|---------|--------|------|------------|----------|
| **Fact Extraction** | 🔥🔥🔥 | FREE | Low | ✅ **Done** |
| **Query Understanding** | 🔥🔥🔥 | FREE | Low | #1 Next |
| **Contradiction Detection** | 🔥🔥 | FREE | Medium | #2 |
| **Knowledge Consolidation** | 🔥🔥 | FREE | Medium | #3 |
| **Retrieval Re-ranking** | 🔥 | FREE | Low | #4 |
| **Session Memory** | 🔥🔥 | FREE | Low | #5 |
| **Ontology Reflection** | 🔥 | FREE | High | Later |
| **Character Response** | 🔥🔥 | FREE | Low | Later |

---

## 1. Query Understanding (HIGH IMPACT)

**Current:**
```typescript
// Simple keyword matching + basic intent detection
const intent = detectIntent(query); // 6 types: fact, how, why, etc.
```

**AI-Powered:**
```typescript
// Understand what user REALLY wants
const analysis = await ai.analyzeQuery(query, {
  intent: 'procedural',  // "how to..."
  entities: ['micrometre', 'outside micrometer'],
  context_needed: ['measurement_tools', 'precision_instruments'],
  ambiguity: 0.1,  // Low = clear intent
  suggested_expansions: [
    'how to use outside micrometer',
    'micrometer measurement technique',
    'precision measurement tools'
  ]
});
```

**Benefits:**
- 40% better retrieval (catches related concepts)
- Handles ambiguous queries ("tell me about fires" → Class A/B/C context)
- Auto-expands abbreviations ("ODE" → "Ordinary Differential Equations")
- Detects follow-up questions ("what about class B?" → needs class A context)

**Cost:** ~500 tokens per query = FREE with FreeLLM

---

## 2. Contradiction Detection (HIGH IMPACT)

**Current:**
```typescript
// Keyword-based contradiction check
if (newFact.contains("X is Y") && existing.contains("X is NOT Y")) {
  flagContradiction();
}
```

**AI-Powered:**
```typescript
const contradiction = await ai.detectContradiction(newFact, existingFacts, {
  explanation: true,
  severity: 'high',  // high/medium/low
  resolution_suggestion: 'merge'  // merge/clarify/flag
});

// Catches semantic contradictions:
// "Water boils at 100°C" vs "Water boils at 212°F"
// → AI knows these are the SAME (not contradictory)
// "Water boils at 100°C" vs "Water boils at 50°C"
// → AI flags as contradiction (different temps)
```

**Benefits:**
- Catches semantic contradictions (not just keyword conflicts)
- Avoids false positives (100°C = 212°F)
- Suggests resolutions (merge, clarify, flag for review)

**Cost:** ~1000 tokens per new fact = FREE

---

## 3. Knowledge Consolidation (HIGH IMPACT)

**Current:**
```typescript
// Simple deduplication
if (similarity(newFact, existing) > 0.95) {
  skip();  // Duplicate
}
```

**AI-Powered:**
```typescript
const consolidation = await ai.consolidateFacts([fact1, fact2, fact3], {
  merge: true,
  keep_sources: true,
  create_hierarchy: true
});

// Example:
// Input: 
//   - "Micrometers measure external dimensions"
//   - "Outside micrometers measure outer diameter"
//   - "External micrometers are for outside measurements"
// Output:
//   - "Micrometers (also called outside/external micrometers) measure external dimensions and outer diameter"
```

**Benefits:**
- Merges redundant facts (reduces database bloat)
- Creates hierarchical knowledge (general → specific)
- Preserves all sources (traceability)

**Cost:** ~2000 tokens per consolidation batch = FREE

---

## 4. Retrieval Re-ranking (MEDIUM IMPACT)

**Current:**
```typescript
// MMR re-ranking (diversity + similarity)
const ranked = mmr(results, query, lambda: 0.7);
```

**AI-Powered:**
```typescript
// Cross-encoder re-ranking (understands query-document relevance)
const ranked = await ai.rerank(query, results, {
  model: 'cross-encoder',
  topK: 10
});

// Better at:
// - Understanding "how" vs "what" questions
// - Prioritizing procedural knowledge for "how to" queries
// - Deprioritizing tangential matches
```

**Benefits:**
- 20-30% better answer relevance
- Understands question type (procedural vs factual)
- Better handling of multi-part queries

**Cost:** ~500 tokens per query = FREE

---

## 5. Session Memory (HIGH IMPACT)

**Current:**
```typescript
// Store raw conversation snippets
sessionMemory.push({ role, content, timestamp });
```

**AI-Powered:**
```typescript
// Extract facts FROM conversations
const extracted = await ai.extractSessionFacts(messages, {
  ignore_chit_chat: true,
  focus_on_learning: true,
  link_to_existing: true
});

// Example:
// User: "So if I understand, class A fires are for ordinary combustibles?"
// AI: "Yes, exactly!"
// → Extracted fact: "Class A fires involve ordinary combustibles"
```

**Benefits:**
- Learns from conversations (not just documents)
- Filters out chit-chat (only stores knowledge)
- Links to existing knowledge graph

**Cost:** ~1000 tokens per session = FREE

---

## 6. Ontology Reflection (MEDIUM IMPACT)

**Current:**
```typescript
// Rule-based ontology suggestions
if (edgeType not in registered_types) {
  proposeNewType();
}
```

**AI-Powered:**
```typescript
const suggestions = await ai.analyzeOntology(graph, {
  detect_redundant_nodes: true,
  suggest_merges: true,
  identify_gaps: true,
  propose_new_edges: true
});

// Example output:
// - "Nodes 234 and 567 appear to describe the same concept (95% similar)"
// - "No edges connect 'micrometers' to 'measurement tools' - suggest adding 'is-a' relationship"
// - "Gap detected: No knowledge about 'digital micrometers' in the graph"
```

**Benefits:**
- Self-improving knowledge graph
- Identifies gaps in knowledge
- Suggests better organization

**Cost:** ~5000 tokens per analysis (run daily) = FREE

---

## 7. Character Response (HIGH IMPACT - User-Facing)

**Current:**
```typescript
// Template-based responses
const response = `I found ${results.length} relevant facts: ${facts.join('; ')}`;
```

**AI-Powered:**
```typescript
const response = await ai.generateResponse(query, results, {
  style: 'helpful',  // helpful/concise/detailed/socratic
  cite_sources: true,
  admit_uncertainty: true,
  ask_followups: true
});

// Example:
// "Based on your workshop practice notes, Class A fires involve ordinary combustibles 
// like wood and paper. The extinguishers you mentioned are generally suitable for these.
// 
// Would you like to know about Class B or C fires as well?"
```

**Benefits:**
- Natural, conversational responses
- Admits uncertainty (builds trust)
- Asks helpful follow-up questions
- Cites sources (traceability)

**Cost:** ~1500 tokens per response = FREE

---

## 8. Document Summarization (MEDIUM IMPACT)

**Current:**
```typescript
// No summarization - just facts
```

**AI-Powered:**
```typescript
const summary = await ai.summarizeDocument(text, {
  length: 'medium',  // short/medium/long
  focus: 'technical',  // technical/overview/key-points
  extract_quotes: true
});

// Stored alongside facts for quick overview
```

**Benefits:**
- Quick document overview (don't need to read all facts)
- Helps with retrieval (search summaries too)
- Better for long documents (100+ pages)

**Cost:** ~3000 tokens per document = FREE

---

## Implementation Strategy

### Phase 1: Core (Week 1-2)
- ✅ Fact Extraction (done)
- 🔄 Query Understanding
- 🔄 Contradiction Detection

### Phase 2: Quality (Week 3-4)
- Knowledge Consolidation
- Session Memory
- Character Response

### Phase 3: Advanced (Week 5-6)
- Retrieval Re-ranking
- Ontology Reflection
- Document Summarization

---

## Reversibility Design

**All AI features are designed to be:**

### 1. **Toggle via Environment Variable**
```bash
# Enable/disable individual features
AI_EXTRACTION_ENABLED=true
AI_QUERY_UNDERSTANDING_ENABLED=false
AI_CONTRADICTION_DETECTION=true

# Master switch
AI_ENABLED=false  # Disables ALL AI features, falls back to regex/rules
```

### 2. **Automatic Fallback**
```typescript
try {
  if (process.env.AI_EXTRACTION_ENABLED === 'true') {
    facts = await extractFactsWithAI(text);
  } else {
    facts = extractFactsRegex(text);
  }
} catch (error) {
  // ALWAYS falls back to regex on any error
  logger.warn('AI failed, using regex fallback');
  facts = extractFactsRegex(text);
}
```

### 3. **Per-Request Override**
```typescript
// Force AI: POST /api/omni/train?ai=true
// Force regex: POST /api/omni/train?ai=false
// Default: use env config
const useAI = req.query.ai ?? process.env.AI_EXTRACTION_ENABLED;
```

### 4. **Logging for Audit**
```typescript
logger.info({
  feature: 'extraction',
  method: useAI ? 'ai' : 'regex',
  result: facts.length,
  fallback: false
}, 'Extraction completed');
```

### 5. **Gradual Rollout**
```typescript
// Enable for 10% of requests first
const useAI = Math.random() < 0.1 && process.env.AI_ENABLED;

// Monitor quality, then increase to 50%, then 100%
```

---

## Cost Summary (All Features)

| Feature | Tokens/Use | Uses/Day | Total/Day | Cost/Day |
|---------|------------|----------|-----------|----------|
| Fact Extraction | 10K | 10 PDFs | 100K | $0 |
| Query Understanding | 500 | 100 queries | 50K | $0 |
| Contradiction Detection | 1K | 20 facts | 20K | $0 |
| Knowledge Consolidation | 2K | 5 batches | 10K | $0 |
| Session Memory | 1K | 10 sessions | 10K | $0 |
| Character Response | 1.5K | 100 responses | 150K | $0 |
| **TOTAL** | | | **340K** | **$0** |

**With FreeLLM: Everything is FREE! 🎉**

---

## Next Steps

1. **Enable AI Extraction** (current task)
2. **Add Query Understanding** (next week)
3. **Add Contradiction Detection** (week 2)
4. **Monitor & Tune** (week 3)
5. **Enable More Features** (week 4+)

All features are designed to be:
- ✅ Reversible (env flag)
- ✅ Safe (automatic fallback)
- ✅ Auditable (detailed logging)
- ✅ Free (FreeLLM)
