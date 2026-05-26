/**
 * AI-Powered Fact Extraction
 * 
 * Uses LLM to extract complete, self-contained facts from text.
 * Advantages over regex-based extraction:
 * - Understands context (knows "estab ment" = "establishment")
 * - Preserves complete thoughts (no mid-sentence truncation)
 * - Handles technical terminology correctly
 * - Can summarize and normalize while extracting
 * 
 * Uses FreeLLM API (free, no rate limits)
 * Alternative: Anthropic Claude, OpenAI GPT-4
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createProvider } from 'freellm';

// FreeLLM provider (recommended - free, no limits)
const freellm = createProvider({
  baseURL: process.env.FREELLM_BASE_URL || 'https://freellm.com/api/v1',
  apiKey: process.env.FREELLM_API_KEY || '',
});

// Fallback to OpenAI-compatible API
const openai = createOpenAI({
  baseURL: process.env.FREELLM_BASE_URL || 'https://freellm.com/api/v1',
  apiKey: process.env.FREELLM_API_KEY || 'not-needed',
});

const factSchema = z.object({
  facts: z.array(
    z.object({
      content: z.string().describe('Complete, self-contained fact'),
      confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
      category: z.string().optional().describe('Optional category: technical, definition, process, safety, etc.'),
      source_page: z.number().optional().describe('Page number if available'),
    })
  ).describe('Array of extracted facts'),
  summary: z.string().describe('Brief summary of the document section'),
  unknown_terms: z.array(z.string()).optional().describe('Technical terms that may need definition'),
});

export interface ExtractedFact {
  content: string;
  confidence: number;
  category?: string;
  source_page?: number;
}

export interface AIExtractionResult {
  facts: ExtractedFact[];
  summary: string;
  unknown_terms?: string[];
  tokenCount: number;
  model: string;
}

/**
 * Extract facts using LLM
 * 
 * @param text - Text to extract facts from (up to 50K chars recommended)
 * @param sourceType - Type of source: 'pdf', 'docx', 'web', 'text'
 * @param options - Extraction options
 * @returns Structured extraction result
 */
export async function extractFactsWithAI(
  text: string,
  sourceType: 'pdf' | 'docx' | 'web' | 'text' = 'text',
  options: {
    maxFacts?: number;
    minConfidence?: number;
    includeSummary?: boolean;
    model?: string;
  } = {}
): Promise<AIExtractionResult> {
  const {
    maxFacts = 50,
    minConfidence = 0.6,
    includeSummary = true,
    model = process.env.FREELLM_MODEL || 'gpt-4o', // Default to gpt-4o via FreeLLM
  } = options;

  // Truncate if too long (stay under model limits)
  const maxChars = 50000;
  const truncatedText = text.length > maxChars 
    ? text.substring(0, maxChars) + '...[truncated]' 
    : text;

  const prompt = buildExtractionPrompt(truncatedText, sourceType, maxFacts);

  try {
    const startTime = Date.now();
    
    const result = await generateObject({
      model: openai(model), // Use FreeLLM's OpenAI-compatible endpoint
      schema: factSchema,
      prompt: prompt,
      temperature: 0.1, // Low temp for consistent extraction
      maxTokens: 4000,
    });

    const endTime = Date.now();
    
    console.log(`[AI Extractor] Extraction completed in ${endTime - startTime}ms`);
    console.log(`[AI Extractor] Extracted ${result.object.facts.length} facts`);

    // Filter by confidence
    const filteredFacts = result.object.facts.filter(f => f.confidence >= minConfidence);

    return {
      facts: filteredFacts.map(f => ({
        content: f.content.trim(),
        confidence: f.confidence,
        category: f.category,
        source_page: f.source_page,
      })),
      summary: includeSummary ? result.object.summary : '',
      unknown_terms: result.object.unknown_terms,
      tokenCount: result.usage?.totalTokens || 0,
      model,
    };
  } catch (error) {
    console.error('[AI Extractor] Extraction failed:', error);
    
    // Fallback to regex-based extraction
    console.log('[AI Extractor] Falling back to regex-based extraction');
    const { extractFacts: extractFactsRegex } = await import('./extractor');
    const regexFacts = extractFactsRegex(text);
    
    return {
      facts: regexFacts.map(f => ({
        content: f,
        confidence: 0.5, // Lower confidence for regex-extracted
        category: undefined,
      })),
      summary: '',
      unknown_terms: [],
      tokenCount: 0,
      model: 'fallback-regex',
    };
  }
}

/**
 * Build the extraction prompt
 */
function buildExtractionPrompt(text: string, sourceType: string, maxFacts: number): string {
  const sourceInstructions = {
    pdf: 'This text was extracted from a PDF document. It may contain hyphenation artifacts from line breaks (e.g., "estab-lishment" or "establish ment"). Fix these automatically.',
    docx: 'This text was extracted from a Word document. Preserve formatting and structure where meaningful.',
    web: 'This text was extracted from a web page. Remove navigation elements, ads, and boilerplate.',
    text: 'This is plain text content.',
  };

  return `You are an expert knowledge extractor. Your task is to extract complete, self-contained facts from the following text.

**Source Type**: ${sourceType}
**Note**: ${sourceInstructions[sourceType as keyof typeof sourceInstructions]}

**Extraction Rules**:
1. **Fix word splits**: If you see words broken across lines (e.g., "establish ment", "manuf acturing"), rejoin them correctly.
2. **Complete thoughts only**: Each fact should be understandable on its own. Don't extract fragments.
3. **Preserve technical terms**: Keep terminology exact (e.g., "Class A fires", "micrometre", "diestock").
4. **No truncation**: Don't cut facts mid-thought. If a fact is too long, summarize it completely.
5. **Remove noise**: Skip page numbers, headers, footers, and formatting artifacts.
6. **Confidence scoring**: Rate each fact 0-1 based on completeness and clarity.

**Output Format**:
- Extract up to ${maxFacts} high-quality facts
- Include a brief summary of the document/section
- List any unknown technical terms that may need definition

**Text to process**:
${truncatedTextForPrompt(text)}

Extract facts now. Be thorough but precise.`;
}

/**
 * Truncate text for prompt while preserving structure
 */
function truncatedTextForPrompt(text: string): string {
  const maxPromptChars = 45000; // Leave room for prompt + response
  if (text.length <= maxPromptChars) {
    return text;
  }
  
  // Try to cut at a paragraph boundary
  const cutPoint = text.lastIndexOf('\n\n', maxPromptChars);
  if (cutPoint > maxPromptChars - 5000) {
    return text.substring(0, cutPoint) + '\n\n...[text truncated for length]';
  }
  
  return text.substring(0, maxPromptChars) + '\n\n...[text truncated for length]';
}

/**
 * Batch extraction for large documents
 * Splits text into chunks and extracts from each
 */
export async function extractFactsBatch(
  text: string,
  options: {
    chunkSize?: number;
    overlap?: number;
    maxFactsPerChunk?: number;
  } = {}
): Promise<AIExtractionResult> {
  const {
    chunkSize = 10000,
    overlap = 500,
    maxFactsPerChunk = 20,
  } = options;

  // Split into overlapping chunks
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    
    // Try to cut at sentence boundary
    let cutPoint = end;
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n\n', end);
      cutPoint = Math.max(lastPeriod, lastNewline, start + chunkSize / 2);
    }
    
    chunks.push(text.substring(start, cutPoint));
    start = cutPoint - overlap;
    
    if (start >= text.length) break;
  }

  console.log(`[AI Extractor] Processing ${chunks.length} chunks`);

  // Process each chunk
  const allResults: AIExtractionResult[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[AI Extractor] Processing chunk ${i + 1}/${chunks.length}`);
    const result = await extractFactsWithAI(chunks[i], 'text', {
      maxFacts: maxFactsPerChunk,
      includeSummary: i === 0, // Only summarize first chunk
    });
    allResults.push(result);
    
    // Rate limiting: wait between chunks to avoid API limits
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Merge results
  const allFacts = allResults.flatMap(r => r.facts);
  const allUnknownTerms = [...new Set(allResults.flatMap(r => r.unknown_terms || []))];
  const totalTokens = allResults.reduce((sum, r) => sum + r.tokenCount, 0);

  // Deduplicate facts (simple dedup by content similarity)
  const uniqueFacts = deduplicateFacts(allFacts);

  return {
    facts: uniqueFacts,
    summary: allResults[0]?.summary || '',
    unknown_terms: allUnknownTerms,
    tokenCount: totalTokens,
    model: allResults[0]?.model || 'claude-sonnet-4-20250514',
  };
}

/**
 * Simple deduplication of extracted facts
 */
function deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const seen = new Set<string>();
  const unique: ExtractedFact[] = [];
  
  for (const fact of facts) {
    // Normalize for comparison
    const normalized = fact.content.toLowerCase().replace(/\s+/g, ' ').trim();
    
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(fact);
    }
  }
  
  return unique;
}

/**
 * Cost estimator for AI extraction
 */
export function estimateExtractionCost(
  charCount: number,
  model: string = 'gpt-4o'
): { tokens: number; costUSD: number } {
  // Rough estimate: 1 token ≈ 4 characters
  const estimatedTokens = Math.ceil(charCount / 4);
  
  // FreeLLM is FREE!
  if (model.includes('freellm') || process.env.FREELLM_API_KEY) {
    return {
      tokens: estimatedTokens,
      costUSD: 0,
    };
  }
  
  // Pricing for paid APIs (check current rates)
  const prices: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 5e-6, output: 15e-6 },
    'gpt-4o-mini': { input: 0.15e-6, output: 0.6e-6 },
    'claude-sonnet-4-20250514': { input: 3e-6, output: 15e-6 },
  };
  
  const price = prices[model] || { input: 0, output: 0 };
  const inputCost = (estimatedTokens * price.input) / 1000000;
  const outputCost = (estimatedTokens * 0.2 * price.output) / 1000000; // Output ≈ 20% of input
  
  return {
    tokens: estimatedTokens,
    costUSD: inputCost + outputCost,
  };
}
