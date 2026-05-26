/**
 * Temporal Decay for OmniLearn Knowledge Retrieval
 * Weights recent knowledge higher while preserving old knowledge (aligned with "never forgets")
 * 
 * Based on OpenClaw's temporal decay strategy:
 * - 30-day half-life (configurable)
 * - Minimum 0.5x decay cap (knowledge never fully "forgotten")
 * - Exponential decay function
 */

import { logger } from '../lib/logger.js';

// Configuration
const DEFAULT_HALF_LIFE_DAYS = 30;
const MIN_DECAY_FACTOR = 0.5; // Knowledge always at least 50% retrievable (aligned with "never forgets")

export interface TemporalDecayConfig {
  halfLifeDays: number;
  minDecayFactor: number;
  enabled: boolean;
}

/**
 * Calculate temporal decay factor for a knowledge node
 * 
 * @param createdAt - When the knowledge was learned
 * @param config - Decay configuration
 * @returns Decay factor between minDecayFactor and 1.0
 */
export function calculateTemporalDecay(
  createdAt: Date | string | number,
  config: TemporalDecayConfig = {
    halfLifeDays: DEFAULT_HALF_LIFE_DAYS,
    minDecayFactor: MIN_DECAY_FACTOR,
    enabled: true,
  }
): number {
  if (!config.enabled) return 1.0;
  
  const now = Date.now();
  const createdTime = new Date(createdAt).getTime();
  const daysOld = (now - createdTime) / (1000 * 60 * 60 * 24);
  
  // Exponential decay: decay = 0.5^(daysOld / halfLifeDays)
  const rawDecay = Math.pow(0.5, daysOld / config.halfLifeDays);
  
  // SAFEGUARD: Never decay below minimum (aligned with "never forgets")
  const cappedDecay = Math.max(config.minDecayFactor, rawDecay);
  
  logger.debug(
    { daysOld, halfLifeDays: config.halfLifeDays, rawDecay, cappedDecay },
    'Temporal decay calculated'
  );
  
  return cappedDecay;
}

/**
 * Apply temporal decay to retrieval results
 * 
 * @param results - Retrieved nodes with similarity scores
 * @param config - Decay configuration
 * @returns Results with decayed similarity scores
 */
export function applyTemporalDecay<T extends { 
  similarity: number; 
  createdAt?: Date | string | number;
}>(
  results: T[],
  config: TemporalDecayConfig = {
    halfLifeDays: DEFAULT_HALF_LIFE_DAYS,
    minDecayFactor: MIN_DECAY_FACTOR,
    enabled: true,
  }
): T[] {
  if (!config.enabled) return results;
  
  return results.map(node => {
    if (!node.createdAt) {
      // No creation date, assume recent (no decay)
      return node;
    }
    
    const decay = calculateTemporalDecay(node.createdAt, config);
    const decayedSimilarity = node.similarity * decay;
    
    logger.debug(
      { 
        nodeId: (node as any).id,
        originalScore: node.similarity,
        decayFactor: decay,
        decayedScore: decayedSimilarity,
        age: node.createdAt 
      },
      'Applied temporal decay to node'
    );
    
    return {
      ...node,
      similarity: decayedSimilarity,
      // Store decay factor for debugging/transparency
      temporalDecay: decay,
    } as T;
  });
}

/**
 * Suggest half-life based on knowledge domain
 */
export function suggestHalfLife(domain: string): number {
  const domainLower = domain.toLowerCase();
  
  // Fast-changing domains (shorter half-life)
  const fastChanging = [
    'news',
    'current events',
    'technology trends',
    'market prices',
    'sports',
    'weather',
  ];
  
  if (fastChanging.some(d => domainLower.includes(d))) {
    return 7; // 1 week half-life
  }
  
  // Stable domains (longer half-life)
  const stable = [
    'mathematics',
    'physics',
    'chemistry',
    'history',
    'philosophy',
    'language',
    'grammar',
  ];
  
  if (stable.some(d => domainLower.includes(d))) {
    return 90; // 3 months half-life
  }
  
  // Default
  return DEFAULT_HALF_LIFE_DAYS;
}

/**
 * Calculate "learned X days ago" text for user-facing display
 */
export function formatKnowledgeAge(createdAt: Date | string | number): string {
  const now = Date.now();
  const createdTime = new Date(createdAt).getTime();
  const daysOld = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
  
  if (daysOld === 0) return 'learned today';
  if (daysOld === 1) return 'learned yesterday';
  if (daysOld < 7) return `learned ${daysOld} days ago`;
  if (daysOld < 30) return `learned ${Math.floor(daysOld / 7)} weeks ago`;
  if (daysOld < 365) return `learned ${Math.floor(daysOld / 30)} months ago`;
  return `learned ${Math.floor(daysOld / 365)} years ago`;
}

/**
 * Get temporal decay metadata for API response
 */
export function getTemporalMetadata(
  createdAt: Date | string | number,
  similarity: number,
  decayedSimilarity: number
): {
  learnedAt: string;
  age: string;
  decayFactor: number;
  originalScore: number;
  decayedScore: number;
} {
  return {
    learnedAt: new Date(createdAt).toISOString(),
    age: formatKnowledgeAge(createdAt),
    decayFactor: decayedSimilarity / similarity,
    originalScore: similarity,
    decayedScore: decayedSimilarity,
  };
}
