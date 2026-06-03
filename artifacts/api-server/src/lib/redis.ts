/**
 * Redis Client for Omnilearn
 * 
 * Provides centralized caching across all API instances
 * - Query results cache (replaces in-memory node-cache)
 * - Permission cache (replaces in-memory Map)
 * - Network data, session state, etc.
 * 
 * Uses Upstash Redis (serverless, free tier: 100MB, 10K ops/day)
 * Alternative: Redis Cloud, AWS ElastiCache, Railway Redis addon
 */

import Redis from 'ioredis';
import { logger } from './logger.js';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_TLS = process.env.REDIS_TLS === 'true';

// TTL defaults (in seconds)
export const TTL = {
  QUERY_CACHE: 3600,           // 1 hour (knowledge queries)
  PERMISSION_CACHE: 300,       // 5 minutes (user permissions)
  NETWORK_STATS: 60,           // 1 minute (network stats)
  CHARACTER_STATE: 300,        // 5 minutes (character traits)
  ONTOLOGY_CACHE: 600,         // 10 minutes (ontology proposals)
  PROPOSAL_CACHE: 300,         // 5 minutes (Hebbian proposals)
  RATE_LIMIT_WINDOW: 60,       // 1 minute (rate limiting)
  SESSION_DATA: 86400,         // 24 hours (session state)
};

// Key prefixes for organization
export const KEY = {
  QUERY: (query: string, clerkId: string | null, topK: number) => 
    `query:${hashKey(query)}:${clerkId ?? 'global'}:${topK}`,
  PERMISSION: (clerkId: string) => `perm:${clerkId}`,
  NETWORK_STATS: () => 'network:stats',
  NETWORK_NEURONS: () => 'network:neurons',
  NETWORK_AGENTS: () => 'network:agents',
  CHARACTER: (clerkId: string | null) => `char:${clerkId ?? 'global'}`,
  ONTOLOGY_VOCAB: () => 'ontology:vocab',
  ONTOLOGY_PROPOSALS: (status?: string) => `ontology:proposals:${status ?? 'all'}`,
  PROPOSALS: (status?: string) => `proposals:${status ?? 'all'}`,
  RATE_LIMIT: (identifier: string, endpoint: string) => `rl:${identifier}:${endpoint}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
};

// Simple hash function for cache keys
function hashKey(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Initialize Redis client
let redisClient: Redis | null = null;
let redisAvailable = false;

export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  if (!REDIS_URL && !REDIS_HOST) {
    logger.warn('Redis not configured - falling back to in-memory cache');
    return null;
  }

  try {
    // Upstash Redis (URL-based)
    if (REDIS_URL) {
      redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        connectTimeout: 5000,
        commandTimeout: 2000,
        tls: REDIS_URL.includes('upstash') ? {} : undefined,
      });
    } 
    // Traditional Redis (host/port)
    else if (REDIS_HOST) {
      redisClient = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        tls: REDIS_TLS ? {} : undefined,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        connectTimeout: 5000,
        commandTimeout: 2000,
      });
    }

    if (redisClient) {
      redisClient.on('error', (err) => {
        logger.error({ err }, 'Redis connection error');
        redisAvailable = false;
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected');
        redisAvailable = true;
      });

      redisClient.on('close', () => {
        logger.warn('Redis connection closed');
        redisAvailable = false;
      });

      redisClient.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });
    }

    return redisClient;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Redis');
    return null;
  }
}

// Check if Redis is available
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    await client.ping();
    redisAvailable = true;
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

// Generic cache operations
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return null;

  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    logger.error({ err, key }, 'Cache get failed');
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = TTL.QUERY_CACHE
): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;

  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return true;
  } catch (err) {
    logger.error({ err, key }, 'Cache set failed');
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;

  try {
    await client.del(key);
    return true;
  } catch (err) {
    logger.error({ err, key }, 'Cache delete failed');
    return false;
  }
}

export async function cacheDeletePattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return 0;

  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;
    return await client.del(...keys);
  } catch (err) {
    logger.error({ err, pattern }, 'Cache delete pattern failed');
    return 0;
  }
}

// Convenience wrappers for common operations
export const queryCache = {
  get: <T>(query: string, clerkId: string | null, topK: number) =>
    cacheGet<T>(KEY.QUERY(query, clerkId, topK)),
  
  set: (query: string, clerkId: string | null, topK: number, data: unknown) =>
    cacheSet(KEY.QUERY(query, clerkId, topK), data, TTL.QUERY_CACHE),
  
  delete: (query: string, clerkId: string | null, topK: number) =>
    cacheDelete(KEY.QUERY(query, clerkId, topK)),
  
  clearUser: (clerkId: string) =>
    cacheDeletePattern(`query:*:${clerkId}:*`),
};

export const permissionCache = {
  get: (clerkId: string) => cacheGet(KEY.PERMISSION(clerkId)),
  set: (clerkId: string, data: unknown) =>
    cacheSet(KEY.PERMISSION(clerkId), data, TTL.PERMISSION_CACHE),
  delete: (clerkId: string) => cacheDelete(KEY.PERMISSION(clerkId)),
};

export const networkCache = {
  stats: {
    get: () => cacheGet(KEY.NETWORK_STATS()),
    set: (data: unknown) => cacheSet(KEY.NETWORK_STATS(), data, TTL.NETWORK_STATS),
  },
  neurons: {
    get: () => cacheGet(KEY.NETWORK_NEURONS()),
    set: (data: unknown) => cacheSet(KEY.NETWORK_NEURONS(), data, TTL.QUERY_CACHE),
  },
  agents: {
    get: () => cacheGet(KEY.NETWORK_AGENTS()),
    set: (data: unknown) => cacheSet(KEY.NETWORK_AGENTS(), data, TTL.QUERY_CACHE),
  },
};

export const characterCache = {
  get: (clerkId: string | null) => cacheGet(KEY.CHARACTER(clerkId)),
  set: (clerkId: string | null, data: unknown) =>
    cacheSet(KEY.CHARACTER(clerkId), data, TTL.CHARACTER_STATE),
};

// Health check
export async function getRedisHealth() {
  const client = getRedisClient();
  if (!client) {
    return {
      available: false,
      reason: 'Redis not configured',
    };
  }

  try {
    const [ping, info] = await Promise.all([
      client.ping(),
      client.info('stats'),
    ]);

    return {
      available: ping === 'PONG',
      info: parseRedisInfo(info),
    };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = info.split('\r\n');
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':');
      result[key] = value;
    }
  }
  return result;
}

// Graceful shutdown
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisAvailable = false;
    logger.info('Redis connection closed');
  }
}
