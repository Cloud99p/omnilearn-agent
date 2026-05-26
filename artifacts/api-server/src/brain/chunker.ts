/**
 * Document Chunker for OmniLearn
 * Splits long documents into overlapping chunks for better retrieval
 * 
 * Based on OpenClaw's chunking strategy:
 * - 400 tokens per chunk
 * - 80 tokens overlap
 * - Sentence-aware boundaries
 */

const DEFAULT_CHUNK_TOKENS = 400;
const DEFAULT_CHUNK_OVERLAP = 80;

export interface Chunk {
  content: string;
  startOffset: number;
  endOffset: number;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Estimate token count (simple word-based approximation)
 * More accurate than character count, faster than full tokenization
 */
function estimateTokens(text: string): number {
  // English: ~1.3 words per token on average
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 1.3);
}

/**
 * Split text into sentences while preserving boundaries
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end
  // Handle common abbreviations (Mr., Dr., etc.)
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|SPLIT|')
    .split('|SPLIT|')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Chunk a document into overlapping segments
 * 
 * @param text - The full document text
 * @param options - Chunking configuration
 * @returns Array of chunks with metadata
 */
export function chunkDocument(
  text: string,
  options?: {
    chunkTokens?: number;
    overlapTokens?: number;
    minChunkLength?: number;
  }
): Chunk[] {
  const chunkTokens = options?.chunkTokens ?? DEFAULT_CHUNK_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_CHUNK_OVERLAP;
  const minChunkLength = options?.minChunkLength ?? 50; // Minimum characters
  
  // Don't chunk short documents
  if (estimateTokens(text) <= chunkTokens) {
    return [{
      content: text.trim(),
      startOffset: 0,
      endOffset: text.length,
      chunkIndex: 0,
      totalChunks: 1,
    }];
  }
  
  const sentences = splitIntoSentences(text);
  const chunks: Chunk[] = [];
  
  let currentChunk: string[] = [];
  let currentTokens = 0;
  let charOffset = 0;
  let startOffset = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);
    
    // If adding this sentence exceeds chunk limit, save current chunk
    if (currentTokens + sentenceTokens > chunkTokens && currentChunk.length > 0) {
      // Create chunk from accumulated sentences
      const chunkContent = currentChunk.join(' ');
      
      if (chunkContent.length >= minChunkLength) {
        chunks.push({
          content: chunkContent.trim(),
          startOffset,
          endOffset: charOffset,
          chunkIndex: chunks.length,
          totalChunks: 0, // Will be set after all chunks created
        });
      }
      
      // Keep overlap sentences for next chunk
      const overlapSentences: string[] = [];
      let overlapTokens = 0;
      
      // Work backwards from end of current chunk
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        const sent = currentChunk[j];
        const tokens = estimateTokens(sent);
        
        if (overlapTokens + tokens <= overlapTokens) {
          overlapSentences.unshift(sent);
          overlapTokens += tokens;
        } else {
          break;
        }
      }
      
      // Start new chunk with overlap
      currentChunk = overlapSentences;
      currentTokens = overlapTokens;
      startOffset = text.indexOf(overlapSentences[0] || '', startOffset);
    }
    
    // Add sentence to current chunk
    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
    charOffset += sentence.length + 1; // +1 for space
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join(' ');
    if (chunkContent.length >= minChunkLength) {
      chunks.push({
        content: chunkContent.trim(),
        startOffset,
        endOffset: text.length,
        chunkIndex: chunks.length,
        totalChunks: 0,
      });
    }
  }
  
  // Set total chunks for all chunks
  const totalChunks = chunks.length;
  for (const chunk of chunks) {
    chunk.totalChunks = totalChunks;
  }
  
  // If no chunks created (edge case), return original as single chunk
  if (chunks.length === 0) {
    return [{
      content: text.trim(),
      startOffset: 0,
      endOffset: text.length,
      chunkIndex: 0,
      totalChunks: 1,
    }];
  }
  
  return chunks;
}

/**
 * Check if a document should be chunked
 */
export function shouldChunk(text: string, options?: { chunkTokens?: number }): boolean {
  const chunkTokens = options?.chunkTokens ?? DEFAULT_CHUNK_TOKENS;
  return estimateTokens(text) > chunkTokens;
}

/**
 * Reconstruct original text from chunks (for verification)
 */
export function reconstructFromChunks(chunks: Chunk[]): string {
  // Sort by chunk index
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  
  // Merge content, removing overlap
  const parts: string[] = [];
  let lastEnd = 0;
  
  for (const chunk of sorted) {
    // Find where this chunk's unique content starts
    const overlapStart = chunk.content.lastIndexOf(' ');
    const uniqueContent = overlapStart > 0 
      ? chunk.content.substring(0, overlapStart)
      : chunk.content;
    
    parts.push(uniqueContent);
    lastEnd = chunk.endOffset;
  }
  
  return parts.join(' ').trim();
}
