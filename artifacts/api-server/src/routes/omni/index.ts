import { Router } from "express";
import chatRouter from "./chat.js";
import knowledgeRouter from "./knowledge.js";
import trainRouter from "./train.js";
import characterRouter from "./character.js";
import smarterProofRouter from "./smarter-proof.js";
import growthHistoryRouter from "./growth-history.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// DEBUG: Log all requests to omni router
router.use((req, res, next) => {
  logger.info({
    path: req.path,
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: (router as any).baseUrl,
  }, "OMNI ROUTER - Request received");
  next();
});

// SPECIFIC routes first (relative to /omni mount point in routes/index.ts)
logger.info("Mounting /train route");
router.use("/train", trainRouter);
logger.info("Mounting /knowledge route");
router.use("/knowledge", knowledgeRouter);
logger.info("Mounting /character route");
router.use("/character", characterRouter);
logger.info("Mounting /smarter-proof route");
router.use("/smarter-proof", smarterProofRouter);
logger.info("Mounting /growth-history route");
router.use("/growth-history", growthHistoryRouter);

// CATCH-ALL route last
logger.info("Mounting /chat route");
router.use("/chat", chatRouter);

// DEBUG: Catch-all for unmatched routes
router.use((req, res) => {
  logger.warn({
    path: req.path,
    method: req.method,
    url: req.url,
  }, "OMNI ROUTER - No route matched");
  res.status(404).json({ error: "Route not found", path: req.path, method: req.method });
});

export default router;
