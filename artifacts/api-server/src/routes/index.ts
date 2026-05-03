import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat/index.js";
import skillsRouter from "./skills/index.js";
import meRouter from "./me/index.js";
import githubRouter from "./github/index.js";
import omniRouter from "./omni/index.js";
import ghostRouter from "./ghost/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/anthropic", chatRouter);
router.use("/skills", skillsRouter);
router.use(meRouter);
router.use(githubRouter);
router.use(omniRouter);
router.use(ghostRouter);

export default router;
