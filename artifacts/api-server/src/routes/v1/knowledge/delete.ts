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
import { requireAuthInProduction } from "../../../middlewares/productionGuard.js";
import { logger } from "../../../lib/logger.js";

const router = Router();

router.post("/delete", optionalAuth, requireAuthInProduction, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;
    const service = authReq.service;

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

    logger.info({ clerkId, service: service?.name ?? null, metadataFilter }, "Knowledge delete via v1 API");

    // Match metadata IN POSTGRES.
    //
    // The previous implementation fetched an arbitrary, unordered window
    // (LIMIT 2000) and filtered in JS afterwards. Metadata lives inside the
    // `content` JSON blob, so any matching node outside that window was
    // invisible to the filter and the purge silently reported deleted: 0
    // while leaving transcript data in the graph. It also meant correctness
    // depended on which rows Postgres happened to return first.
    //
    // The `@>` containment operator does the matching in the database, so
    // there is no window and no silent miss: a scoped delete either removes
    // every matching node or fails loudly.
    //
    // Guarded cast: `content` is a text column, and a row that is not valid
    // JSON would throw on a plain ::jsonb cast, 500-ing the whole request.
    // CASE keeps non-JSON rows as '{}' so they simply never match.
    const safeContent = sql`(CASE WHEN ${knowledgeNodes.content} ~ '^\\s*\\{' THEN ${knowledgeNodes.content}::jsonb ELSE '{}'::jsonb END)`;
    const metadataMatch = sql`${safeContent} -> 'metadata' @> ${JSON.stringify(metadataFilter)}::jsonb`;

    const scopeCondition = clerkId
      ? sql`clerk_id = ${clerkId}`
      : service
        ? sql`service_id = ${service.id}`
        : sql`TRUE`;

    const rows = await db
      .select({ id: knowledgeNodes.id })
      .from(knowledgeNodes)
      .where(sql`${scopeCondition} AND ${metadataMatch}`);

    const ids = rows.map((node) => node.id);

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
