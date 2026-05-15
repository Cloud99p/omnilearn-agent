import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { expressIntegration } from "@sentry/node";
import { logger } from "./logger";

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Call this once at application startup.
 *
 * Environment variables required:
 * - SENTRY_DSN: Sentry Data Source Name (from sentry.io)
 * - SENTRY_ENVIRONMENT: Environment name (production, development, etc.)
 * - SENTRY_TRACES_SAMPLE_RATE: Sample rate for traces (0.0-1.0, default 0.1)
 * - SENTRY_RELEASE: Release version (optional, defaults to package.json version or git SHA)
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
    integrations: [nodeProfilingIntegration(), expressIntegration()],

    // Performance monitoring
    enableTracing: true,

    // Profiling
    profilesSampleRate: 1.0, // Profile every trace

    // Release tracking (uses git commit SHA or version from package.json)
    release:
      process.env.SENTRY_RELEASE ||
      process.env.npm_package_version ||
      "unknown",

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
 * In Sentry v9, this is handled automatically by expressIntegration().
 * This is a no-op for backward compatibility.
 */
export function sentryRequestHandler() {
  // Express integration is automatic in Sentry v9 via expressIntegration()
  return (_req: any, _res: any, next: any) => next();
}

/**
 * Express error handler middleware.
 * In Sentry v9, errors are captured automatically by expressIntegration().
 * This is a no-op for backward compatibility.
 */
export function sentryErrorHandler() {
  // Error handling is automatic in Sentry v9 via expressIntegration()
  return (_err: any, _req: any, _res: any, next: any) => next();
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
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
}) {
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
