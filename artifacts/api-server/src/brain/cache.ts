/**
 * Query Cache for OmniLearn Knowledge Retrieval
 * Hybrid Redis + in-memory LRU cache
 * 
 * Strategy:
 * - Redis: Primary cache (shared across instances, survives restarts)
 * - NodeCache: Fallback when Redis unavailable
 * - 1-hour TTL, 1000 max entries for in-memory
 */

import NodeCache from 'node-cache';
import { logger } from '../lib/logger.js';
import { queryCache as redisCache, isRedisAvailable } from '../lib/redis.js';

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
 * Tries Redis first, falls back to in-memory cache
 */
export async function retrieveFromCache<T>(
  query: string,
  clerkId: string | null,
  topK: number
): Promise<T | null> {
  const cacheKey = generateCacheKey(query, clerkId, topK);
  
  // Try Redis first
  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    try {
      const cached = await redisCache.get<T>(query, clerkId, topK);
      if (cached) {
        cacheStats.hits++;
        logger.debug(
          { query: query.slice(0, 50), cacheKey, source: 'redis', hits: cacheStats.hits },
          'Cache hit (Redis)'
        );
        return cached;
      }
    } catch (err) {
      logger.warn({ err }, 'Redis cache get failed, falling back to in-memory');
    }
  }
  
  // Fall back to in-memory
  const cached = queryCache.get<T>(cacheKey);
  if (cached) {
    cacheStats.hits++;
    logger.debug(
      { query: query.slice(0, 50), cacheKey, source: 'memory', hits: cacheStats.hits },
      'Cache hit (memory)'
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
 * Stores in both Redis and in-memory for redundancy
 */
export async function storeInCache<T>(
  query: string,
  clerkId: string | null,
  topK: number,
  data: T
): Promise<void> {
  const cacheKey = generateCacheKey(query, clerkId, topK);
  
  // Store in Redis (async, fire-and-forget)
  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    redisCache.set(query, clerkId, topK, data).catch((err) => {
      logger.warn({ err }, 'Redis cache set failed');
    });
  }
  
  // Always store in-memory as fallback
  const success = queryCache.set(cacheKey, data);
  
  if (success) {
    logger.debug(
      { query: query.slice(0, 50), cacheKey, ttl: CACHE_TTL_SECONDS, redis: redisAvailable },
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
  
  // Store in cache (async, non-blocking)
  await storeInCache(query, clerkId, topK, results);
  
  return results;
}
