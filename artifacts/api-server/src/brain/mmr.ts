/**
 * Maximal Marginal Relevance (MMR) for OmniLearn
 * Re-ranks retrieval results to balance relevance and diversity
 * 
 * Based on OpenClaw's MMR implementation:
 * - Lambda = 0.7 (70% relevance, 30% diversity)
 * - Prevents redundant results
 * - Improves answer quality
 */

export interface MMRResult {
  id: number;
  content: string;
  embedding: number[] | null;
  similarity: number;
  mmrScore: number;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Apply Maximal Marginal Relevance re-ranking
 * 
 * @param queryEmbedding - The query vector
 * @param candidates - Candidate results to re-rank
 * @param lambda - Balance between relevance (1.0) and diversity (0.0)
 *                 Default: 0.7 (70% relevance, 30% diversity)
 * @param topK - Number of results to return
 * @returns Re-ranked results with MMR scores
 */
export function maximalMarginalRelevance(
  queryEmbedding: number[],
  candidates: Array<{
    id: number;
    content: string;
    embedding: number[] | null;
    similarity: number;
  }>,
  lambda: number = 0.7,
  topK: number = 6
): MMRResult[] {
  // Validate lambda
  if (lambda < 0 || lambda > 1) {
    throw new Error(`Lambda must be between 0 and 1, got ${lambda}`);
  }
  
  // Handle edge cases
  if (!candidates || candidates.length === 0) return [];
  if (!queryEmbedding || queryEmbedding.length === 0) {
    // Fall back to original similarity ranking
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(c => ({ ...c, mmrScore: c.similarity }));
  }
  
  const selected: MMRResult[] = [];
  const remaining = candidates.map(c => ({ ...c }));
  
  // Select first result based on highest similarity to query
  if (remaining.length > 0) {
    remaining.sort((a, b) => b.similarity - a.similarity);
    const best = remaining.shift()!;
    selected.push({
      ...best,
      mmrScore: best.similarity,
    });
  }
  
  // Greedily select remaining results
  while (selected.length < topK && remaining.length > 0) {
    // Score each remaining candidate
    const scored = remaining.map(candidate => {
      // Similarity to query (relevance)
      const querySim = candidate.similarity;
      
      // Maximum similarity to already selected results (redundancy)
      let maxSelectedSim = 0;
      for (const selectedItem of selected) {
        if (candidate.embedding && selectedItem.embedding) {
          const simToSelected = cosineSimilarity(
            candidate.embedding,
            selectedItem.embedding
          );
          maxSelectedSim = Math.max(maxSelectedSim, simToSelected);
        }
      }
      
      // MMR score: maximize relevance, minimize redundancy
      const mmrScore = lambda * querySim - (1 - lambda) * maxSelectedSim;
      
      return {
        candidate,
        mmrScore,
      };
    });
    
    // Select candidate with highest MMR score
    scored.sort((a, b) => b.mmrScore - a.mmrScore);
    const best = scored[0];
    
    selected.push({
      ...best.candidate,
      mmrScore: best.mmrScore,
    });
    
    // Remove from remaining
    remaining.splice(remaining.indexOf(best.candidate), 1);
  }
  
  return selected;
}

/**
 * Calculate diversity score for a set of results
 * Useful for evaluating MMR effectiveness
 */
export function calculateDiversityScore(results: MMRResult[]): number {
  if (results.length <= 1) return 1.0;
  
  let totalDissimilarity = 0;
  let pairCount = 0;
  
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      if (results[i].embedding && results[j].embedding) {
        const similarity = cosineSimilarity(
          results[i].embedding,
          results[j].embedding
        );
        totalDissimilarity += (1 - similarity);
        pairCount++;
      }
    }
  }
  
  return pairCount > 0 ? totalDissimilarity / pairCount : 1.0;
}

/**
 * Determine optimal lambda based on query characteristics
 */
export function suggestLambda(query: string): number {
  const queryLower = query.toLowerCase();
  
  // Exploratory queries benefit from more diversity
  const exploratoryPatterns = [
    /tell me about/i,
    /what do you know about/i,
    /explain.*broadly/i,
    /overview of/i,
    /introduction to/i,
  ];
  
  if (exploratoryPatterns.some(p => p.test(query))) {
    return 0.6; // More diversity (60% relevance, 40% diversity)
  }
  
  // Specific queries need more relevance
  const specificPatterns = [
    /what is the/i,
    /how do i/i,
    /calculate/i,
    /find.*specific/i,
    /\?$/, // Questions
  ];
  
  if (specificPatterns.some(p => p.test(query))) {
    return 0.8; // More relevance (80% relevance, 20% diversity)
  }
  
  // Default balance
  return 0.7;
}
