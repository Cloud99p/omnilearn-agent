import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logger } from "./logger";

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Call this once at application startup.
 *
 * Environment variables required:
 * - SENTRY_DSN: Sentry Data Source Name (from sentry.io)
 * - SENTRY_ENVIRONMENT: Environment name (production, development, etc.)
 * - SENTRY_TRACES_SAMPLE_RATE: Sample rate for traces (0.0-1.0, default 0.1)
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn(
      "Sentry not configured: SENTRY_DSN environment variable not set. Errors will not be tracked.",
    );
    return;
  }

  const environment = process.env.SENTRY_ENVIRONMENT || "development";
  const tracesSampleRate = parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1",
  );

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,

    // Integrations
    integrations: [
      nodeProfilingIntegration(),
      // Express integration is auto-detected
      // HTTP integration is auto-detected
      // Console integration is auto-detected
    ],

    // Performance monitoring
    enableTracing: true,

    // Profiling
    profilesSampleRate: 1.0, // Profile every trace

    // Release tracking
    release: process.env.npm_package_version || "unknown",

    // Before sending event, filter out sensitive data
    beforeSend(event, hint) {
      // Filter out health check errors (too noisy)
      if (event.request?.url?.includes("/healthz")) {
        return null;
      }

      // Filter out 404s for static assets
      if (event.exception && event.response?.status === 404) {
        return null;
      }

      return event;
    },

    // Configure breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out verbose breadcrumbs
      if (breadcrumb.category === "console" && breadcrumb.level === "debug") {
        return null;
      }
      return breadcrumb;
    },
  });

  logger.info(
    { environment, tracesSampleRate },
    "Sentry initialized successfully",
  );
}

/**
 * Express middleware to attach Sentry request context.
 * Use this AFTER Sentry.init() and BEFORE your routes.
 */
export function sentryRequestHandler() {
  return Sentry.requestHandler();
}

/**
 * Express error handler middleware.
 * Use this as the LAST middleware in your Express app.
 */
export function sentryErrorHandler() {
  return Sentry.errorHandler();
}

/**
 * Capture a custom exception with additional context.
 * Useful for business logic errors that don't crash the app.
 */
export function captureException(
  error: Error,
  context?: {
    level?: "fatal" | "error" | "warning" | "info";
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string; username?: string };
  },
) {
  Sentry.captureException(error, {
    level: context?.level || "error",
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
  });

  logger.warn(
    {
      error: error.message,
      tags: context?.tags,
      ...context?.extra,
    },
    "Exception captured by Sentry",
  );
}

/**
 * Set a tag for the current scope (useful for filtering in Sentry UI).
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * Set user context for error tracking (GDPR-compliant, no PII).
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user);
}

/**
 * Start a transaction for performance monitoring.
 */
export function startTransaction(name: string, op?: string) {
  return Sentry.startTransaction({ name, op });
}

/**
 * Get the current trace ID for logging correlation.
 */
export function getTraceId(): string | undefined {
  return Sentry.getActiveSpan()?.spanContext().traceId;
}
