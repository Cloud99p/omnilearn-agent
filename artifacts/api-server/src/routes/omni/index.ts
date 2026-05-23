import { Router } from "express";
import chatRouter from "./chat.js";
import knowledgeRouter from "./knowledge.js";
import trainRouter from "./train.js";
import characterRouter from "./character.js";
import smarterProofRouter from "./smarter-proof.js";
import growthHistoryRouter from "./growth-history.js";
import conversationsRouter from "./conversations.js";

const router = Router();

// SPECIFIC routes first (before catch-all /omni)
router.use("/omni/train", trainRouter);
router.use("/omni/knowledge", knowledgeRouter);
router.use("/omni/character", characterRouter);
router.use("/omni/smarter-proof", smarterProofRouter);
router.use("/omni/growth-history", growthHistoryRouter);
router.use("/omni/conversations", conversationsRouter); // Conversation management

// CATCH-ALL route last
router.use("/omni", chatRouter);

export default router;
