import rateLimit from "express-rate-limit";
import { logger } from "./logger";

/**
 * Rate limiting configuration for API endpoints.
 * Prevents abuse and protects free-tier infrastructure.
 */

// Default rate limit: 100 requests per 15 minutes
export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "You have exceeded the rate limit. Please try again later.",
    retryAfter: "900 seconds",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
      retryAfter: "900 seconds",
    });
  },
  // Skip rate limiting for health checks
  skip: (req) => req.path === "/healthz",
});

// Stricter limit for chat endpoints (prevent API abuse)
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 chat requests per hour
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
  max: 10, // Limit each IP to 10 GitHub requests per hour
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
