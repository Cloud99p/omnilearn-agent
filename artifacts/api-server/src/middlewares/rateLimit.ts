import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

/**
 * Rate limiting configuration for API endpoints.
 * Prevents abuse and protects free-tier infrastructure.
 * 
 * NOTE: These limits are generous for development/testing.
 * For production, consider reducing:
 * - chatLimiter: 100 → 30 requests/hour
 * - defaultLimiter: 100 → 60 requests/15min
 * - githubLimiter: 30 → 10 requests/hour
 */

// Default rate limit: DISABLED for efficient training
export const defaultLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000, // Effectively unlimited for development/testing
  trustProxy: true, // Required when app.set('trust proxy', true)
  message: {
    error: "Too many requests",
    message: "You have exceeded the rate limit. Please try again later.",
    retryAfter: "3600 seconds",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get("user-agent"),
      },
      "Rate limit exceeded",
    );
    res.status(429).json({
      error: "Too many requests",
      message: "You have exceeded the rate limit. Please try again later.",
      retryAfter: "3600 seconds",
    });
  },
  skip: (req) => req.path === "/healthz",
});

// Chat endpoints: DISABLED for efficient training
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000, // Effectively unlimited for development/testing
  trustProxy: true, // Required when app.set('trust proxy', true)
  message: {
    error: "Too many chat requests",
    message: "You have exceeded the hourly chat limit. Please try again later.",
    retryAfter: "3600 seconds",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: (req as any).auth?.userId,
      },
      "Chat rate limit exceeded",
    );
    res.status(429).json({
      error: "Too many chat requests",
      message: "You have exceeded the hourly chat limit. Please try again later.",
      retryAfter: "3600 seconds",
    });
  },
});

// Very strict limit for skill creation (prevent spam)
export const skillCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 skill creations per hour
  trustProxy: true, // Required when app.set('trust proxy', true)
  message: {
    error: "Too many skill creation attempts",
    message: "You have exceeded the skill creation limit. Please try again later.",
    retryAfter: "3600 seconds",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: (req as any).auth?.userId,
      },
      "Skill creation rate limit exceeded",
    );
    res.status(429).json({
      error: "Too many skill creation attempts",
      message: "You have exceeded the skill creation limit. Please try again later.",
      retryAfter: "3600 seconds",
    });
  },
});

// Strict limit for GitHub operations (API quota protection)
export const githubLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 GitHub requests per hour (increased for testing)
  trustProxy: true, // Required when app.set('trust proxy', true)
  message: {
    error: "Too many GitHub requests",
    message: "You have exceeded the GitHub API rate limit. Please try again later.",
    retryAfter: "3600 seconds",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: (req as any).auth?.userId,
      },
      "GitHub rate limit exceeded",
    );
    res.status(429).json({
      error: "Too many GitHub requests",
      message: "You have exceeded the GitHub API rate limit. Please try again later.",
      retryAfter: "3600 seconds",
    });
  },
});

// Export a middleware factory for custom limits
export function createLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  name?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: "Too many requests",
      message: options.message || "You have exceeded the rate limit. Please try again later.",
      retryAfter: `${Math.floor(options.windowMs / 1000)} seconds`,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
          method: req.method,
          limiterName: options.name || "custom",
        },
        "Custom rate limit exceeded",
      );
      res.status(429).json({
        error: "Too many requests",
        message: options.message || "You have exceeded the rate limit. Please try again later.",
        retryAfter: `${Math.floor(options.windowMs / 1000)} seconds`,
      });
    },
  });
}
