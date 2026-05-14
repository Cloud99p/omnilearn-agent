import { Router } from "express";
import chatRouter from "./chat.js";
import knowledgeRouter from "./knowledge.js";
import trainRouter from "./train.js";
import characterRouter from "./character.js";
import benchmarkRouter from "./benchmark.js";
import smarterProofRouter from "./smarter-proof.js";
import growthHistoryRouter from "./growth-history.js";

const router = Router();

// SPECIFIC routes first (before catch-all /omni)
router.use("/omni/train", trainRouter);
router.use("/omni/knowledge", knowledgeRouter);
router.use("/omni/character", characterRouter);
router.use("/omni/benchmark", benchmarkRouter);
router.use("/omni/smarter-proof", smarterProofRouter);
router.use("/omni/growth-history", growthHistoryRouter);

// CATCH-ALL route last
router.use("/omni", chatRouter);

export default router;
