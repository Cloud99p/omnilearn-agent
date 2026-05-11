// Ghost network DISABLED - This agent operates independently
// All distributed/ghost features are disabled by configuration

import { Router } from "express";
import disabledRouter from "./disabled.js";

const router = Router();

// All ghost endpoints return 501 Not Implemented
router.use("/ghost", disabledRouter);

export default router;
