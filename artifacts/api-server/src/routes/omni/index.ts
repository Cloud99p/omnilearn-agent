import { Router } from "express";
import chatRouter from "./chat.js";
import knowledgeRouter from "./knowledge.js";
import trainRouter from "./train.js";
import characterRouter from "./character.js";

const router = Router();

router.use("/omni", chatRouter);
router.use("/omni/knowledge", knowledgeRouter);
router.use("/omni/train", trainRouter);
router.use("/omni/character", characterRouter);

export default router;
