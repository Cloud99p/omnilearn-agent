import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";

const router = Router();

// Apply Clerk auth
router.use(clerkMiddleware());

// GET /api/repositories - List repositories
router.get("/", async (req, res) => {
  try {
    const repositories = [
      {
        id: 1,
        name: "omnilearn-agent",
        owner: "Cloud99p",
        description: "AI agent with persistent knowledge graph",
        url: "https://github.com/Cloud99p/omnilearn-agent",
        stars: 0,
        forks: 0,
        language: "TypeScript",
        lastUpdated: new Date().toISOString(),
      },
    ];

    res.json({ repositories });
  } catch (err) {
    req.log.error(err, "Failed to list repositories");
    res.status(500).json({ error: "Failed to list repositories" });
  }
});

export default router;
