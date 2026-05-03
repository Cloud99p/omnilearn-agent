import { Router } from "express";
import { trainOnText, seedIfEmpty } from "../../brain/index.js";
import { contributeNeurons } from "../../brain/network.js";

const router = Router();

// POST /api/omni/train — ingest text and extract knowledge from it
router.post("/", async (req, res) => {
  const { text, source = "manual" } = req.body as { text: string; source?: string };

  if (!text?.trim() || text.trim().length < 10) {
    res.status(400).json({ error: "text must be at least 10 characters" });
    return;
  }

  await seedIfEmpty();

  const result = await trainOnText(text.trim(), source, null);

  // Feed extracted knowledge into the shared network brain (fire-and-forget)
  if (result.nodes && result.nodes.length > 0) {
    contributeNeurons(
      result.nodes.map((n: { content: string; type?: string; tags?: string[] }) => ({
        content: n.content,
        type: n.type,
        tags: n.tags ?? [],
      })),
      "self"
    ).catch(() => {});
  }

  res.json({
    ...result,
    message: result.added > 0
      ? `Integrated ${result.added} knowledge item${result.added > 1 ? "s" : ""}. ${result.skipped > 0 ? `${result.skipped} skipped (already known).` : ""}`
      : `No new knowledge extracted. ${result.skipped} items already in knowledge base.`,
  });
});

export default router;
