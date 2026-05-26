/**
 * Query Cache for OmniLearn Knowledge Retrieval
 * LRU cache to reduce redundant embedding computations
 * 
 * Based on OpenClaw's caching strategy:
 * - 1-hour TTL (3600 seconds)
 * - 1000 max entries
 * - LRU eviction policy
 */

import NodeCache from 'node-cache';
import { logger } from '../lib/logger.js';

export interface CachedQuery {
  query: string;
  clerkId: string | null;
  results: Array<{
    id: number;
    content: string;
    similarity: number;
  }>;
  cachedAt: number;
  hits: number;
}

// Cache configuration
const CACHE_TTL_SECONDS = 3600; // 1 hour
const CACHE_MAX_ENTRIES = 1000;
const CACHE_CHECK_PERIOD_SECONDS = 60; // Clean expired entries every minute

// Initialize cache
const queryCache = new NodeCache({
  stdTTL: CACHE_TTL_SECONDS,
  checkperiod: CACHE_CHECK_PERIOD_SECONDS,
  maxKeys: CACHE_MAX_ENTRIES,
  useClones: false, // Return references for performance
});

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  expired: 0,
};

// Track cache events
queryCache.on('expired', (key) => {
  cacheStats.expired++;
  logger.debug({ key }, 'Cache entry expired');
});

queryCache.on('del', (key) => {
  logger.debug({ key }, 'Cache entry deleted');
});

/**
 * Generate cache key from query parameters
 */
function generateCacheKey(
  query: string | null | undefined,
  clerkId: string | null,
  topK: number
): string {
  const safeQuery = (query ?? '').toLowerCase().trim();
  return `query:${safeQuery}:${clerkId ?? 'global'}:${topK}`;
}

/**
 * Retrieve from cache with statistics tracking
 */
export async function retrieveFromCache<T>(
  query: string,
  clerkId: string | null,
  topK: number
): Promise<T | null> {
  const cacheKey = generateCacheKey(query, clerkId, topK);
  const cached = queryCache.get<T>(cacheKey);
  
  if (cached) {
    cacheStats.hits++;
    logger.debug(
      { query: query.slice(0, 50), cacheKey, hits: cacheStats.hits },
      'Cache hit'
    );
    return cached;
  }
  
  cacheStats.misses++;
  logger.debug(
    { query: query.slice(0, 50), cacheKey, misses: cacheStats.misses },
    'Cache miss'
  );
  
  return null;
}

/**
 * Store in cache with metadata
 */
export function storeInCache<T>(
  query: string,
  clerkId: string | null,
  topK: number,
  data: T
): void {
  const cacheKey = generateCacheKey(query, clerkId, topK);
  const success = queryCache.set(cacheKey, data);
  
  if (success) {
    logger.debug(
      { query: query.slice(0, 50), cacheKey, ttl: CACHE_TTL_SECONDS },
      'Stored in cache'
    );
  } else {
    cacheStats.evictions++;
    logger.warn(
      { query: query.slice(0, 50), cacheKey, maxKeys: CACHE_MAX_ENTRIES },
      'Cache full, entry evicted'
    );
  }
}

/**
 * Clear cache for specific clerkId (user data deletion)
 */
export function clearCacheForUser(clerkId: string): void {
  const keys = queryCache.keys();
  const userKeys = keys.filter(key => key.includes(`:${clerkId}:`));
  
  for (const key of userKeys) {
    queryCache.del(key);
  }
  
  logger.info(
    { clerkId, clearedCount: userKeys.length },
    'Cleared user cache entries'
  );
}

/**
 * Clear entire cache (maintenance/debugging)
 */
export function clearAllCache(): void {
  queryCache.flushAll();
  cacheStats = { hits: 0, misses: 0, evictions: 0, expired: 0 };
  logger.info('Cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  expired: number;
  size: number;
  maxKeys: number;
} {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? (cacheStats.hits / total) * 100 : 0;
  
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate,
    evictions: cacheStats.evictions,
    expired: cacheStats.expired,
    size: queryCache.getStats().keys,
    maxKeys: CACHE_MAX_ENTRIES,
  };
}

/**
 * Phase 2 improvement: Wrap retrieval with caching
 */
export async function retrieveWithCache<T>(
  retrievalFn: () => Promise<T>,
  query: string,
  clerkId: string | null,
  topK: number
): Promise<T> {
  // Try cache first
  const cached = await retrieveFromCache<T>(query, clerkId, topK);
  if (cached) {
    return cached;
  }
  
  // Cache miss, perform retrieval
  const results = await retrievalFn();
  
  // Store in cache
  storeInCache(query, clerkId, topK, results);
  
  return results;
}
