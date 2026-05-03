import { Router } from "express";
import nodesRouter from "./nodes.js";
import chatRouter from "./chat.js";
import executeRouter from "./execute.js";
import githubRouter from "./github.js";
import workerRouter from "./worker.js";
import gossipProbeRouter from "./gossip-probe.js";

const router = Router();

router.use("/ghost", nodesRouter);
router.use("/ghost", chatRouter);
router.use("/ghost", executeRouter);
router.use("/ghost", workerRouter);
router.use("/ghost", gossipProbeRouter);
router.use(githubRouter);

export default router;
