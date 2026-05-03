import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat/index.js";
import skillsRouter from "./skills/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/anthropic", chatRouter);
router.use("/skills", skillsRouter);

export default router;
