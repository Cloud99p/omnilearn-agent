import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { trainOnText, seedIfEmpty } from "../../brain/index.js";
import { contributeNeurons } from "../../brain/network.js";
import { fetchUrl } from "../../brain/web-tools.js";
import { extractTextFromFile } from "../../brain/document-tools.js";
import fs from "fs/promises";
import { logger } from "../../lib/logger.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../../uploads/train");

// Ensure uploads directory exists
await fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

// Configure multer for file uploads in train endpoint
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// POST /api/omni/train — ingest text and extract knowledge from it
// Supports: { text, url, file, source } — if url or file provided, fetches/extracts first
// NOTE: No auth required - anyone can train
router.post("/", upload.single("file"), async (req, res) => {
  // Get clerkId if user is authenticated (optional)
  const clerkId = (req as any).auth?.userId || null;
  const {
    text,
    url,
    source = "manual",
  } = req.body as { text?: string; url?: string; source?: string };
  const file = req.file;

  // Validate input: need either text, url, or file
  if ((!text?.trim() || text.trim().length < 10) && !url?.trim() && !file) {
    res
      .status(400)
      .json({
        error:
          "Provide either text (min 10 chars), a URL to fetch, or upload a document file",
      });
    return;
  }

  await seedIfEmpty();

  let textToTrain = text?.trim();
  let extractionMethod = source;

  // If file uploaded, extract text from it
  if (file) {
    try {
      const extracted = await extractTextFromFile(
        file.path,
        file.mimetype,
        file.originalname,
      );
      textToTrain = extracted.text;
      extractionMethod = `file:${file.mimetype}`;
      logger.info(
        { file: file.originalname, size: file.size, method: extracted.method },
        "Document uploaded for training",
      );

      // Clean up uploaded file
      await fs.unlink(file.path).catch(() => {});
    } catch (err) {
      logger.error({ err, file: file.originalname }, "File extraction failed");
      res
        .status(400)
        .json({
          error: `Failed to extract text from file: ${err instanceof Error ? err.message : String(err)}`,
        });
      return;
    }
  }

  // If URL provided without text (or with minimal text), fetch the URL first
  if (url?.trim() && (!textToTrain || textToTrain.length < 10)) {
    try {
      const fetched = await fetchUrl(url.trim());
      textToTrain = fetched.text;
      extractionMethod = `url:${url.trim()}`;
    } catch (err) {
      res
        .status(400)
        .json({
          error: `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`,
        });
      return;
    }
  }

  if (!textToTrain || textToTrain.length < 10) {
    res.status(400).json({ error: "No usable text content found" });
    return;
  }

  logger.info({ textLength: textToTrain.length, source: extractionMethod }, "Training request received");
  const result = await trainOnText(textToTrain, extractionMethod, clerkId);
  logger.info({ added: result.added, skipped: result.skipped, total: result.nodes.length }, "Training complete");

  // Feed extracted knowledge into the shared network brain (fire-and-forget)
  if (result.nodes && result.nodes.length > 0) {
    contributeNeurons(
      result.nodes.map(
        (n: { content: string; type?: string; tags?: string[] }) => ({
          content: n.content,
          type: n.type,
          tags: n.tags ?? [],
        }),
      ),
      "self",
    ).catch(() => {});
  }

  res.json({
    ...result,
    message:
      result.added > 0
        ? `Integrated ${result.added} knowledge item${result.added > 1 ? "s" : ""}. ${result.skipped > 0 ? `${result.skipped} skipped (already known).` : ""}`
        : `No new knowledge extracted. ${result.skipped} items already in knowledge base.`,
  });
});

export default router;
