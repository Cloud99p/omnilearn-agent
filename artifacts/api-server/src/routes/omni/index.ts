import { Router } from "express";
import chatRouter from "./chat.js";
import knowledgeRouter from "./knowledge.js";
import trainRouter from "./train.js";
import characterRouter from "./character.js";
import smarterProofRouter from "./smarter-proof.js";
import growthHistoryRouter from "./growth-history.js";

const router = Router();

// SPECIFIC routes first (before catch-all)
router.use("/train", trainRouter);
router.use("/knowledge", knowledgeRouter);
router.use("/character", characterRouter);
router.use("/smarter-proof", smarterProofRouter);
router.use("/growth-history", growthHistoryRouter);

// CATCH-ALL route last
router.use("/chat", chatRouter);

export default router;
