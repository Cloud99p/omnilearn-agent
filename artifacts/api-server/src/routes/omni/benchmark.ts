import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { synthesizeNative } from "../../brain/native-synthesizer.js";

const router = Router();

// ─── POST /api/omni/benchmark ─────────────────────────────────────────────────
// Runs the same question through two paths and returns both responses:
//   1. raw  — native synthesis with no knowledge context
//   2. augmented — native synthesis with retrieved knowledge nodes
router.post("/benchmark", async (req, res) => {
  const { question } = req.body as { question?: string };

  if (!question?.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  try {
    req.log.info({ question }, "Running benchmark");

    // 1. Retrieve relevant knowledge nodes from DB
    const tokens = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3);

    const allNodes = await db
      .select({
        id: knowledgeNodes.id,
        content: knowledgeNodes.content,
        type: knowledgeNodes.type,
        tags: knowledgeNodes.tags,
        confidence: knowledgeNodes.confidence,
        timesAccessed: knowledgeNodes.timesAccessed,
      })
      .from(knowledgeNodes)
      .orderBy(desc(knowledgeNodes.confidence))
      .limit(50);

    // Filter by token matching
    const relevantNodes = allNodes
      .filter((node) => {
        const nodeText = node.content.toLowerCase();
        return tokens.some((token) => nodeText.includes(token));
      })
      .slice(0, 8);

    req.log.info(
      { nodesFound: relevantNodes.length },
      "Retrieved knowledge nodes",
    );

    // 2. Path A — Raw (no knowledge context)
    const rawContext = {
      query: question.trim(),
      queryType: "question" as const,
      nodes: [],
      character: {
        curiosity: 50,
        confidence: 50,
        caution: 50,
        technical: 50,
        empathy: 50,
        verbosity: 50,
        creativity: 50,
      },
      history: [],
    };

    const rawResult = await synthesizeNative(rawContext);

    // 3. Path B — Augmented (with knowledge)
    const augContext = {
      query: question.trim(),
      queryType: "question" as const,
      nodes: relevantNodes.map((n) => ({ ...n, similarity: 0.5 })),
      character: {
        curiosity: 50,
        confidence: 50,
        caution: 50,
        technical: 50,
        empathy: 50,
        verbosity: 50,
        creativity: 50,
      },
      history: [],
    };

    const augResult = await synthesizeNative(augContext);

    // 4. Compute quality signals
    const wordCount = (s: string) =>
      s.trim().split(/\s+/).filter(Boolean).length;
    const sentenceCount = (s: string) => (s.match(/[.!?]+/g) ?? []).length;

    const knowledgeTerms = relevantNodes.flatMap((n) =>
      n.content
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 4),
    );
    const uniqueTerms = [...new Set(knowledgeTerms)];
    const augLower = augResult.text.toLowerCase();
    const termsHit = uniqueTerms.filter((t) => augLower.includes(t)).length;
    const rawLower = rawResult.text.toLowerCase();
    const rawTermsHit = uniqueTerms.filter((t) => rawLower.includes(t)).length;

    res.json({
      question: question.trim(),
      raw: {
        text: rawResult.text,
        wordCount: wordCount(rawResult.text),
        sentences: sentenceCount(rawResult.text),
        knowledgeTermsUsed: rawTermsHit,
        citations: 0,
      },
      augmented: {
        text: augResult.text,
        wordCount: wordCount(augResult.text),
        sentences: sentenceCount(augResult.text),
        knowledgeTermsUsed: termsHit,
        citations: 0,
      },
      knowledge: {
        nodesRetrieved: relevantNodes.length,
        totalNodesSearched: allNodes.length,
        nodes: relevantNodes.map((n) => ({
          id: n.id,
          content: n.content,
          type: n.type,
          confidence: n.confidence,
          similarity: 0.5,
          timesAccessed: n.timesAccessed,
        })),
      },
      delta: {
        wordCountDiff: wordCount(augResult.text) - wordCount(rawResult.text),
        sentenceDiff:
          sentenceCount(augResult.text) - sentenceCount(rawResult.text),
        knowledgeTermsDiff: termsHit - rawTermsHit,
      },
    });
  } catch (err) {
    req.log.error({ err }, "benchmark failed");
    res.status(500).json({
      error: "benchmark failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
