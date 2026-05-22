# Phase 2: Context-Aware Retrieval

## Goal
Shift from **keyword matching** to **context-aware semantic understanding** by using conversation history in knowledge retrieval.

---

## What Was Changed

### 1. Added `buildContextualQuery()` Function
**Location:** `artifacts/api-server/src/brain/index.ts`

Builds an enriched query by combining:
- Current user message
- Last 3 assistant responses (contain knowledge context)
- Last 3 user messages (contain follow-up context)

**Example:**
```
User: "What's a neural network?"
Assistant: "A neural network is..."
User: "Explain more on this"

Without context: retrieves "neural network" facts
With context: retrieves "neural network" + related concepts from previous explanation
```

### 2. Modified `retrieveRelevantNodes()`
**Changes:**
- Added optional `history` parameter
- Uses `enrichedQuery` instead of raw `query` for TF-IDF and embeddings
- Increased embedding weight from 70% → 80%

### 3. Updated `processMessage()`
**Location:** `artifacts/api-server/src/brain/index.ts:543`

Now passes `history` to `retrieveRelevantNodes()` for context-aware retrieval.

---

## Impact

### Before (Keyword-Based)
```
Query: "Explain more"
Retrieval: Nothing (no keywords match)
Response: Generic answer
```

### After (Context-Aware)
```
Query: "Explain more"
Context: Previous question was about "neural networks"
Retrieval: Neural network facts + related concepts
Response: Specific, contextual explanation
```

---

## Expected Improvements

1. **Better follow-up handling** - "Explain more", "Tell me about that" work correctly
2. **Contextual references** - "It", "this", "that" refer to previous topics
3. **Improved retrieval accuracy** - 80% embedding-based vs 70% before
4. **More natural conversations** - Less keyword-matching, more semantic understanding

---

## Testing

Send these messages in order:

1. "What is a knowledge graph?"
2. "Explain more on this"
3. "How does it learn?"

**Expected:** Each response should reference the previous context, not give generic answers.

---

## Next Steps

- Monitor retrieval quality over next 7 days
- Collect training logs from FreeLLM responses
- Phase 3: Weekly analysis job to identify knowledge gaps and update synthesizer
