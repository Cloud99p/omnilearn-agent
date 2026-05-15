import { Router, type IRouter } from "express";
import * as Sentry from "@sentry/node";

const router: IRouter = Router();

/**
 * Test endpoint to verify Sentry is working.
 * Throws an intentional error that Sentry should capture.
 *
 * Usage: GET /api/debug-sentry
 */
router.get("/debug-sentry", (_req, res) => {
  // Send response first
  res.json({
    status: "error-thrown",
    message: "Check Sentry dashboard - an error should appear in ~5 seconds",
    timestamp: new Date().toISOString(),
  });

  // Throw error after response (so user sees the error in Sentry)
  setTimeout(() => {
    const testError = new Error("🧪 TEST ERROR - Sentry verification");
    testError.name = "SentryTestError";

    // Add custom tags for easy identification
    Sentry.setTag("test", "sentry-verification");
    Sentry.setTag("environment", process.env.SENTRY_ENVIRONMENT || "unknown");

    // Capture the error
    Sentry.captureException(testError, {
      level: "error",
      extra: {
        purpose: "This is a test error to verify Sentry integration",
        timestamp: new Date().toISOString(),
        user: "system-test",
      },
    });

    console.log("[Sentry Test] Error captured and sent to Sentry dashboard");
  }, 100);
});

/**
 * Test endpoint for performance monitoring.
 * Creates a sample transaction to verify tracing works.
 *
 * Usage: GET /api/debug-sentry-transaction
 */
router.get("/debug-sentry-transaction", async (req, res) => {
  const transaction = Sentry.startTransaction({
    name: "test-transaction",
    op: "http.server",
    tags: { test: "transaction-verification" },
  });

  try {
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    transaction.setTag("test", "transaction-completed");

    res.json({
      status: "transaction-completed",
      message: "Check Sentry Performance dashboard for this transaction",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    transaction.setStatus("internal_error");
    throw error;
  } finally {
    transaction.finish();
  }
});

export default router;
