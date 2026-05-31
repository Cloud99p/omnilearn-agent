import { Router, type IRouter } from "express";
import healthRouter from "./health";
import debugRouter from "./debug.js";
import chatRouter from "./chat/index.js";
import localChatRouter from "./local/chat.js";
import skillsRouter from "./skills/index.js";
import meRouter from "./me/index.js";
import githubRouter from "./github/index.js";
import omniRouter from "./omni/index.js";
import ghostRouter from "./ghost/index.js";
import networkRouter from "./network.js";
import networkStatsRouter from "./network-stats.js";
import brainProposalsRouter from "./brain/proposals.js";
import brainOntologyRouter from "./brain/ontology.js";
import { characterRouter } from "./character.js";
import { moderationRouter } from "./moderation.js";
import knowledgeRouter from "./knowledge.js";
import dnaRouter from "./dna.js";
import modesRouter from "./modes.js";
import intelligenceRouter from "./intelligence.js";
import complianceRouter from "./compliance.js";
import configRouter from "./config.js";
import storageRouter from "./storage.js";
import repositoriesRouter from "./repositories.js";
import documentsRouter from "./documents.js";
import accessControlRouter from "./access-control.js";
import { logger } from "../lib/logger.js";
import {
  defaultLimiter,
  chatLimiter,
  skillCreateLimiter,
  githubLimiter,
} from "../middlewares/rateLimit";

const router: IRouter = Router();

// Apply rate limiters to routes
router.use(healthRouter); // No rate limit on health checks

// SECURITY: Debug endpoints ONLY in development
// Disabled in production to prevent reconnaissance
if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
  router.use(debugRouter); // Debug/test endpoints (no rate limit)
  logger.info("Debug endpoints enabled (development mode)");
} else {
  logger.info("Debug endpoints disabled (production mode)");
}
router.use("/anthropic", chatLimiter, chatRouter); // Main chat (30 req/hour)
router.use("/local", chatLimiter, localChatRouter); // Local chat (30 req/hour)
router.use("/skills", defaultLimiter, skillsRouter); // Default limit (100 req/15min)
router.use(meRouter); // Default limit
router.use(githubLimiter, githubRouter); // GitHub API (10 req/hour)
router.use(defaultLimiter, omniRouter); // Default limit (routes use /omni/ prefix internally)
router.use(defaultLimiter, ghostRouter); // Default limit
router.use(defaultLimiter, networkRouter); // Default limit
router.use(defaultLimiter, networkStatsRouter); // Network stats endpoints
router.use("/brain", defaultLimiter, brainProposalsRouter); // Default limit
router.use("/brain", defaultLimiter, brainOntologyRouter); // Default limit
router.use("/moderation", defaultLimiter, moderationRouter); // Default limit
// character & knowledge routes handled by omniRouter
router.use("/dna", defaultLimiter, dnaRouter); // Instance DNA
router.use("/modes", defaultLimiter, modesRouter); // Operating modes
router.use("/intelligence", defaultLimiter, intelligenceRouter); // Intelligence stats
router.use("/compliance", defaultLimiter, complianceRouter); // Compliance rules
router.use("/config", defaultLimiter, configRouter); // Configuration
router.use("/storage", defaultLimiter, storageRouter); // Storage stats
router.use("/repositories", defaultLimiter, repositoriesRouter); // Repositories
router.use("/documents", defaultLimiter, documentsRouter); // Document ingestion
router.use("/access", defaultLimiter, accessControlRouter); // Access control (RBAC, teams, permissions)

export default router;
