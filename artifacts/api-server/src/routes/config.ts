import { Router } from "express";

const router = Router();

// GET /api/config - Get configuration
router.get("/", async (req, res) => {
  try {
    const config = {
      instance: {
        id: process.env.INSTANCE_ID || "local",
        name: process.env.INSTANCE_NAME || "OmniLearn Local",
      },
      modes: {
        default: process.env.DEFAULT_MODE || "native",
        available: ["local", "native", "ghost", "anthropic"],
      },
      features: {
        webSearch: process.env.WEB_SEARCH !== "false",
        distributed: process.env.DISTRIBUTED === "true",
        compliance: process.env.COMPLIANCE !== "false",
      },
      limits: {
        maxContextLength: 8192,
        maxKnowledgeNodes: 10000,
        maxWorkers: 10,
      },
    };

    res.json(config);
  } catch (err) {
    req.log.error(err, "Failed to get config");
    res.status(500).json({ error: "Failed to get config" });
  }
});

// PUT /api/config - Update configuration
router.put("/", async (req, res) => {
  try {
    const config = req.body;

    // In production, this would persist to config file
    res.json({ success: true, message: "Configuration updated" });
  } catch (err) {
    req.log.error(err, "Failed to update config");
    res.status(500).json({ error: "Failed to update config" });
  }
});

export default router;
