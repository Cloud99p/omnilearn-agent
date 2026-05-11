import { Router } from "express";

const router = Router();

// All ghost network endpoints disabled - agent operates independently
router.use("/*", (req, res) => {
  res.status(501).json({
    error: "Ghost network is disabled",
    disabled: true,
    reason: "This agent operates independently. Distributed/ghost features are disabled by configuration.",
    endpoints: {
      "/api/ghost/nodes": "DISABLED",
      "/api/ghost/worker": "DISABLED",
      "/api/ghost/chat": "DISABLED",
      "/api/ghost/execute": "DISABLED",
      "/api/ghost/github": "DISABLED",
      "/api/ghost/gossip": "DISABLED",
    },
  });
});

export default router;
