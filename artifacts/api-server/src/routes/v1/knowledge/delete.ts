/**
 * V1 Knowledge API - Delete Endpoint
 * POST /api/v1/knowledge/delete
 *
 * Deletes knowledge nodes scoped by metadata (e.g. a meetingId) so MeetPlay
 * can purge a meeting's transcript nodes on meeting end. Requires
 * `metadataFilter` (object of key -> value matched against stored metadata);
 * without it the request is rejected (safety: no bulk wipe).
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { inArray, sql } from "drizzle-orm";
import { optionalAuth, AuthenticatedRequest } from "../../../middlewares/optionalAuth.js";
import { logger } from "../../../lib/logger.js";

const router = Router();

router.post("/delete", optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;

    const { metadataFilter } = req.body;

    if (!metadataFilter || typeof metadataFilter !== "object" || Array.isArray(metadataFilter)) {
      res.status(400).json({ success: false, error: "metadataFilter object is required" });
      return;
    }

    const filterKeys = Object.keys(metadataFilter);
    if (filterKeys.length === 0) {
      res.status(400).json({ success: false, error: "metadataFilter must contain at least one key" });
      return;
    }

    logger.info({ clerkId, metadataFilter }, "Knowledge delete via v1 API");

    // Fetch a generous window, then filter in JS (metadata lives inside the
    // content JSON blob) — same approach as search.ts.
    const fetchLimit = 2000;
    const rows = await db
      .select()
      .from(knowledgeNodes)
      .where(clerkId ? sql`clerk_id = ${clerkId}` : sql`TRUE`)
      .limit(fetchLimit);

    const ids = rows
      .filter((node) => {
        try {
          const parsed = JSON.parse(node.content);
          const metadata = parsed.metadata || {};
          return filterKeys.every((key) => metadata[key] === metadataFilter[key]);
        } catch {
          return false;
        }
      })
      .map((node) => node.id);

    let deleted = 0;
    if (ids.length > 0) {
      // Delete in chunks to stay within query parameter limits.
      const CHUNK = 500;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const result = await db.delete(knowledgeNodes).where(inArray(knowledgeNodes.id, chunk));
        deleted += result.rowCount ?? chunk.length;
      }
    }

    logger.info({ clerkId, metadataFilter, deleted, matched: ids.length }, "Knowledge deleted via v1 API");

    res.json({ success: true, deleted, matched: ids.length });
  } catch (error) {
    logger.error({ error }, "Failed to delete knowledge");
    res.status(500).json({ success: false, error: "Failed to delete knowledge" });
  }
});

export default router;
