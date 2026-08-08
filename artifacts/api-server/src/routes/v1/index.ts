/**
 * V1 API Router — aggregates all /api/v1 endpoints.
 * These routers existed as standalone files but were never mounted;
 * this index makes the documented V1 API actually reachable.
 */
import { Router } from "express";
import knowledgeRecordRouter from "./knowledge/record.js";
import knowledgeBatchRouter from "./knowledge/batch.js";
import knowledgeSearchRouter from "./knowledge/search.js";
import knowledgeDeleteRouter from "./knowledge/delete.js";
import servicesStatsRouter from "./services/stats.js";
import { logger } from "../../lib/logger.js";

// keep: logger is used at module bottom for mount confirmation

const router = Router();

router.use("/knowledge", knowledgeRecordRouter);
router.use("/knowledge", knowledgeBatchRouter);
router.use("/knowledge", knowledgeSearchRouter);
router.use("/knowledge", knowledgeDeleteRouter);
router.use("/services/me", servicesStatsRouter);

logger.info("V1 API mounted at /api/v1");

export default router;
