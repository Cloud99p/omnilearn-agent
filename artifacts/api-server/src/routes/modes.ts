import { Router } from "express";

const router = Router();

// GET /api/modes - Get available modes
router.get("/", async (req, res) => {
  try {
    const modes = [
      {
        id: "local",
        name: "Local Mode",
        description: "Runs entirely on your hardware without cloud services",
        features: [
          "No external API calls",
          "Uses only local knowledge graph",
          "Fastest response time",
          "Complete privacy",
        ],
        limitations: [
          "Limited to learned knowledge",
          "No web search",
          "No external AI",
        ],
        icon: "🏠",
      },
      {
        id: "native",
        name: "Native Mode",
        description: "Uses OmniLearn's built-in intelligence engine",
        features: [
          "Native synthesis engine",
          "Character-driven responses",
          "Knowledge graph + web search",
          "Evolving personality",
        ],
        limitations: [
          "Requires internet for web search",
          "Slower than local mode",
        ],
        icon: "🧠",
      },
      {
        id: "ghost",
        name: "Ghost Mode",
        description: "Distributed execution across multiple devices",
        features: [
          "Distributed processing",
          "Multiple worker nodes",
          "Collaborative intelligence",
          "Fault tolerance",
        ],
        limitations: [
          "Requires multiple devices",
          "Network latency",
          "Complex setup",
        ],
        icon: "👻",
      },
      {
        id: "anthropic",
        name: "Anthropic Mode",
        description: "Uses Claude API for responses",
        features: [
          "Claude's full capabilities",
          "Advanced reasoning",
          "Large context window",
          "Up-to-date knowledge",
        ],
        limitations: [
          "Requires API key",
          "Cloud dependency",
          "Cost per request",
        ],
        icon: "🤖",
      },
    ];

    res.json({ modes });
  } catch (err) {
    req.log.error(err, "Failed to get modes");
    res.status(500).json({ error: "Failed to get modes" });
  }
});

// PUT /api/modes - Set active mode
router.put("/", async (req, res) => {
  try {
    const { mode } = req.body;

    const validModes = ["local", "native", "ghost", "anthropic"];
    if (!validModes.includes(mode)) {
      res.status(400).json({
        error: `Invalid mode. Must be one of: ${validModes.join(", ")}`,
      });
      return;
    }

    // In production, this would update a config file or env var
    // For now, just acknowledge the request
    res.json({
      success: true,
      mode,
      message: `Switched to ${mode} mode`,
    });
  } catch (err) {
    req.log.error(err, "Failed to set mode");
    res.status(500).json({ error: "Failed to set mode" });
  }
});

export default router;
