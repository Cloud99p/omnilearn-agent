import { Router } from "express";
import { z } from "zod";
import { submitUserReport, moderateContent } from "../lib/moderation.js";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// ─── Report Content ──────────────────────────────────────────────────────────

const reportSchema = z.object({
  contentType: z.enum(["knowledge_node", "network_neuron", "conversation"]),
  contentId: z.number().int().positive(),
  reason: z.enum(["harmful", "pii", "spam", "harassment", "other"]),
  description: z.string().max(500).optional(),
});

router.post("/report", requireAuth, async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const body = reportSchema.parse(req.body);

    const result = await submitUserReport({
      reporterId: clerkId,
      ...body,
    });

    if (result.success) {
      logger.info(
        { clerkId, reportId: result.reportId, ...body },
        "User report submitted"
      );
      res.json({
        success: true,
        reportId: result.reportId,
        message: "Report submitted. Our team will review this content.",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to submit report. Please try again.",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid report data",
        errors: error.errors,
      });
    }

    logger.error({ error }, "Failed to submit user report");
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ─── Test Moderation (Development Only) ─────────────────────────────────────

const testModerationSchema = z.object({
  content: z.string(),
});

router.post("/test", requireAuth, async (req, res) => {
  try {
    const { content } = testModerationSchema.parse(req.body);
    const result = moderateContent(content);

    res.json({
      approved: result.approved,
      reason: result.reason,
      category: result.category,
      severity: result.severity,
      flaggedPatterns: result.flaggedPatterns,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid content",
        errors: error.errors,
      });
    }

    logger.error({ error }, "Failed to test moderation");
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export { router as moderationRouter };
