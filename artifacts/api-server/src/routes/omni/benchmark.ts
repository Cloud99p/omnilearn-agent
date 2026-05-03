import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { retrieveRelevantNodes, seedIfEmpty } from "../../brain/index.js";

const router = Router();

const MODEL = "claude-sonnet-4-5";

// ─── POST /api/omni/benchmark ─────────────────────────────────────────────────
// Runs the same question through two paths and returns both responses:
//   1. raw  — pure Claude, no knowledge context
//   2. augmented — Claude with retrieved knowledge nodes prepended as context
router.post("/benchmark", async (req, res) => {
  const { question } = req.body as { question?: string };

  if (!question?.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  try {
    await seedIfEmpty();

    // 1. Retrieve relevant knowledge nodes
    const nodes = await retrieveRelevantNodes(question.trim(), null, 8);
    const relevantNodes = nodes.filter(n => n.similarity > 0.05);

    // 2. Build knowledge context block
    const contextBlock = relevantNodes.length > 0
      ? relevantNodes
          .map((n, i) => `[${i + 1}] (${n.type}, confidence ${(n.confidence * 100).toFixed(0)}%) ${n.content}`)
          .join("\n")
      : "";

    // 3. Run BOTH calls to Claude in parallel for speed
    const [rawMsg, augMsg] = await Promise.all([
      // Path A — raw, no knowledge
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: "user", content: question.trim() }],
      }),

      // Path B — knowledge-augmented
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: contextBlock.length > 0
          ? [
              "You are OmniLearn, an AI that reasons over a personal knowledge graph.",
              "",
              "Relevant knowledge retrieved for this query:",
              contextBlock,
              "",
              "Use this knowledge where applicable. Cite the numbered sources inline when you draw on them (e.g. [1]). If the knowledge is irrelevant, answer naturally without forcing a citation.",
            ].join("\n")
          : "You are OmniLearn, an AI assistant. Answer helpfully and accurately.",
        messages: [{ role: "user", content: question.trim() }],
      }),
    ]);

    const rawText =
      rawMsg.content[0]?.type === "text" ? rawMsg.content[0].text : "";
    const augText =
      augMsg.content[0]?.type === "text" ? augMsg.content[0].text : "";

    // 4. Compute quality signals
    const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
    const sentenceCount = (s: string) => (s.match(/[.!?]+/g) ?? []).length;

    // Specificity: ratio of knowledge terms appearing in augmented response
    const knowledgeTerms = relevantNodes.flatMap(n =>
      n.content.toLowerCase().split(/\W+/).filter(w => w.length > 4)
    );
    const uniqueTerms = [...new Set(knowledgeTerms)];
    const augLower = augText.toLowerCase();
    const termsHit = uniqueTerms.filter(t => augLower.includes(t)).length;
    const rawLower = rawText.toLowerCase();
    const rawTermsHit = uniqueTerms.filter(t => rawLower.includes(t)).length;

    const citationCount = (augText.match(/\[\d+\]/g) ?? []).length;

    res.json({
      question: question.trim(),
      raw: {
        text: rawText,
        wordCount: wordCount(rawText),
        sentences: sentenceCount(rawText),
        knowledgeTermsUsed: rawTermsHit,
        citations: 0,
      },
      augmented: {
        text: augText,
        wordCount: wordCount(augText),
        sentences: sentenceCount(augText),
        knowledgeTermsUsed: termsHit,
        citations: citationCount,
      },
      knowledge: {
        nodesRetrieved: relevantNodes.length,
        totalNodesSearched: nodes.length,
        nodes: relevantNodes.map(n => ({
          id: n.id,
          content: n.content,
          type: n.type,
          confidence: n.confidence,
          similarity: n.similarity,
          timesAccessed: n.timesAccessed,
        })),
      },
    });
  } catch (err) {
    req.log?.error(err, "benchmark failed");
    res.status(500).json({ error: "benchmark failed" });
  }
});

export default router;
