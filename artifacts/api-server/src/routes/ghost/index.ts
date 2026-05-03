import { Router } from "express";
import nodesRouter from "./nodes.js";
import chatRouter from "./chat.js";
import executeRouter from "./execute.js";
import githubRouter from "./github.js";

const router = Router();

router.use("/ghost", nodesRouter);
router.use("/ghost", chatRouter);
router.use("/ghost", executeRouter);
router.use(githubRouter);

export default router;
