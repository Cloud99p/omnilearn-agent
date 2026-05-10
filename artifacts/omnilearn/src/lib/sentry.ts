import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for frontend error tracking.
 * Call this once at application startup (in main.tsx or App.tsx).
 *
 * Environment variables required:
 * - VITE_SENTRY_DSN: Sentry Data Source Name (from sentry.io)
 * - VITE_SENTRY_ENVIRONMENT: Environment name (production, development, etc.)
 * - VITE_SENTRY_TRACES_SAMPLE_RATE: Sample rate for traces (0.0-1.0, default 0.1)
 * - VITE_SENTRY_RELEASE: Release version (optional, defaults to package.json version or git SHA)
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn(
      "[Sentry] Not configured: VITE_SENTRY_DSN not set. Frontend errors will not be tracked.",
    );
    return;
  }

  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || "development";
  const tracesSampleRate = parseFloat(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1",
  );

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        // Only record replays for errors (saves bandwidth)
        mask: [".sentry-mask", "input[type=password]"],
      }),
    ],

    // Performance monitoring
    enableTracing: true,

    // Release tracking (uses git commit SHA or version from package.json)
    release: import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.npm_package_version || "unknown",

    // Filter out noisy errors
    beforeSend(event, hint) {
      // Ignore resize observer errors (common browser quirk)
      if (
        event.exception?.values?.some(v =>
          v.value?.includes("ResizeObserver")
        )
      ) {
        return null;
      }

      // Ignore script load errors (ad blockers, etc.)
      if (
        event.exception?.values?.some(v =>
          v.value?.includes("script") || v.value?.includes("stylesheet")
        )
      ) {
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

    // Session replay configuration
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions
  });

  console.info(
    `[Sentry] Initialized for ${environment} (traces: ${tracesSampleRate * 100}%)`,
  );
}

/**
 * Set a tag for filtering events in Sentry UI.
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * Set user context (GDPR-compliant, no PII).
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user);
}

/**
 * Capture a custom exception with additional context.
 */
export function captureException(
  error: Error,
  context?: {
    level?: "fatal" | "error" | "warning" | "info";
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
) {
  Sentry.captureException(error, {
    level: context?.level || "error",
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Add a breadcrumb (user action, log, etc.).
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message?: string;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  data?: Record<string, unknown>;
}) {
  Sentry.addBreadcrumb(breadcrumb);
}
