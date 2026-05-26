# AI-Powered Fact Extraction Setup

This guide shows how to enable AI-powered extraction in OmniLearn, replacing regex-based fact extraction with LLM-based understanding.

## Overview

**Current (regex-based):**
```
PDF → markitdown → regex patterns → extractFacts() → facts
                                          │
                                  (misses splits, truncates)
```

**New (AI-powered):**
```
PDF → markitdown → AI extractor → structured facts
                          │
                  (understands context, no truncation)
```

## Benefits

| Metric | Regex | AI |
|--------|-------|-----|
| **Truncation** | ~15% facts incomplete | ~0% (context-aware) |
| **Word splits** | Needs 60+ patterns | Auto-fixes |
| **Fact quality** | Variable | High confidence scores |
| **Technical terms** | Often wrong | Preserved correctly |
| **Cost** | Free | ~$0.01/page |
| **Latency** | <100ms | 2-5 seconds |

## Prerequisites

1. **API Key** (choose one):
   - Anthropic (recommended): `ANTHROPIC_API_KEY` in Railway
   - OpenAI: `OPENAI_API_KEY` in Railway

2. **Install dependencies**:
   ```bash
   cd artifacts/api-server
   pnpm add ai @ai-sdk/anthropic zod
   # Or for OpenAI:
   # pnpm add ai @ai-sdk/openai zod
   ```

## Configuration

### Option 1: Enable for All Training (Recommended)

Edit `src/routes/omni/train.ts`:

```typescript
// ADD at top of file
import { extractFactsWithAI } from '../../brain/ai-extractor.js';

// REPLACE the extractFacts call in trainOnText() with:
const extraction = await extractFactsWithAI(textToTrain, 'pdf', {
  maxFacts: 50,
  minConfidence: 0.6,
  model: 'claude-sonnet-4-20250514',
});

logger.info(
  { factCount: extraction.facts.length, model: extraction.model },
  "AI extraction completed"
);

// Use AI-extracted facts instead of regex
const facts = extraction.facts.map(f => f.content);
```

### Option 2: Hybrid Mode (AI Fallback)

Keep regex as default, use AI for problematic content:

```typescript
// Try regex first
let facts = extractFacts(textToTrain, source);

// If too few facts or low quality, try AI
if (facts.length < 5 || textToTrain.length > 100000) {
  logger.info("Regex extraction weak, falling back to AI");
  const aiExtraction = await extractFactsWithAI(textToTrain, 'pdf');
  facts = aiExtraction.facts.map(f => f.content);
}
```

### Option 3: User-Triggered AI Extraction

Add query parameter to enable AI:

```typescript
// In train.ts route handler
const useAI = req.query.ai === 'true';

if (useAI) {
  const extraction = await extractFactsWithAI(textToTrain, 'pdf');
  facts = extraction.facts.map(f => f.content);
} else {
  facts = extractFacts(textToTrain, source);
}
```

Then call: `POST /api/omni/train?ai=true`

## Environment Variables

Add to Railway dashboard:

```bash
# Anthropic (recommended)
ANTHROPIC_API_KEY=sk-ant-...

# Or OpenAI
OPENAI_API_KEY=sk-...

# Optional: Control extraction behavior
AI_EXTRACTOR_MODEL=claude-sonnet-4-20250514
AI_EXTRACTOR_MAX_FACTS=50
AI_EXTRACTOR_MIN_CONFIDENCE=0.6
```

## Cost Estimation

| Document Size | Tokens | Cost (Claude Sonnet) |
|---------------|--------|---------------------|
| 10 pages (PDF) | ~10K | $0.03 |
| 50 pages | ~50K | $0.15 |
| 100 pages | ~100K | $0.30 |
| 1000 pages/month | ~1M | $3.00 |

**Recommendation**: Use AI for PDFs/docs, keep regex for short text messages.

## Testing

1. **Deploy to Railway** with API key set
2. **Upload test PDF** (e.g., "GET 204_Module 1-8.pdf")
3. **Check logs** for:
   ```
   [AI Extractor] Extraction completed in 3421ms
   [AI Extractor] Extracted 23 facts
   ```
4. **Verify facts** are complete (no "ment where...", "spira", etc.)

## Rollback

If AI extraction fails, it automatically falls back to regex:

```typescript
catch (error) {
  console.error('[AI Extractor] Extraction failed:', error);
  // Falls back to regex-based extraction
  const { extractFacts: extractFactsRegex } = await import('./extractor');
  const regexFacts = extractFactsRegex(text);
  // ...
}
```

## Advanced: Batch Processing for Large Documents

For documents >50K chars, use batch extraction:

```typescript
import { extractFactsBatch } from '../../brain/ai-extractor.js';

const extraction = await extractFactsBatch(textToTrain, {
  chunkSize: 10000,
  overlap: 500,
  maxFactsPerChunk: 20,
});
```

This processes in chunks and merges results.

## Monitoring

Track these metrics:

```typescript
// In train.ts, after extraction
logger.info({
  method: extraction.model,
  factCount: extraction.facts.length,
  tokenCount: extraction.tokenCount,
  costEstimate: extraction.tokenCount * 0.000003, // rough $ estimate
  summary: extraction.summary?.substring(0, 100),
}, "Training completed");
```

## Migration Plan

**Week 1**: Deploy AI extractor in parallel (log both regex + AI results)
**Week 2**: Compare quality, tune confidence thresholds
**Week 3**: Switch to AI-only for PDFs, keep regex for chat
**Week 4**: Monitor costs, adjust as needed

## Files Created

- `src/brain/ai-extractor.ts` - Main AI extraction module
- `docs/AI-EXTRACTION-SETUP.md` - This guide

## Files to Modify

- `src/routes/omni/train.ts` - Integration point
- `src/brain/index.ts` - Optional: export AI extractor
- `.env` or Railway dashboard - Add API keys

---

**Questions?** The AI extractor has built-in fallback, so it's safe to enable in production. Start with hybrid mode if concerned about costs.
