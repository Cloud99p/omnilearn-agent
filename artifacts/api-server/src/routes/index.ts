import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat/index.js";
import localChatRouter from "./local/chat.js";
import skillsRouter from "./skills/index.js";
import meRouter from "./me/index.js";
import githubRouter from "./github/index.js";
import omniRouter from "./omni/index.js";
import ghostRouter from "./ghost/index.js";
import networkRouter from "./network.js";
import brainProposalsRouter from "./brain/proposals.js";
import brainOntologyRouter from "./brain/ontology.js";
import { defaultLimiter, chatLimiter, skillCreateLimiter, githubLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

// Apply rate limiters to routes
router.use(healthRouter); // No rate limit on health checks
router.use("/anthropic", chatLimiter, chatRouter);  // Main chat (30 req/hour)
router.use("/local", chatLimiter, localChatRouter);  // Local chat (30 req/hour)
router.use("/skills", defaultLimiter, skillsRouter); // Default limit (100 req/15min)
router.use(meRouter); // Default limit
router.use(githubLimiter, githubRouter); // GitHub API (10 req/hour)
router.use(defaultLimiter, omniRouter); // Default limit
router.use(defaultLimiter, ghostRouter); // Default limit
router.use(defaultLimiter, networkRouter); // Default limit
router.use("/brain", defaultLimiter, brainProposalsRouter); // Default limit
router.use("/brain", defaultLimiter, brainOntologyRouter); // Default limit

export default router;
