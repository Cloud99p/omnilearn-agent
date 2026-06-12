import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, trainingLogs, chatPatterns } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { processMessage, seedIfEmpty, trainOnText } from "../../brain/index.js";
import { callFreeLLM, scoreResponse } from "../../lib/free-llm.js";
import { requireAuth, AuthenticatedRequest } from "../../middlewares/requireAuth.js";
import { optionalAuth } from "../../middlewares/optionalAuth.js";

const router = Router();

// Configuration
// TRAINING MODE: Always use FreeLLM for responses while training the native AI
const ALWAYS_USE_LLM = process.env.ALWAYS_USE_LLM === "true" || true; // Default: true for week 1

// TEACHER MODE: Extract facts from LLM responses
function extractFactsFromLLMResponse(response: string, query: string): string[] {
  // Split into sentences
  const sentences = response
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 400);
  
  // Filter out pure conversational fluff (but keep factual sentences)
  const fluffPatterns = [
    /^(Sure|Certainly|Of course|I'd be happy|Happy to help)/i,
    /^(That's a great|This is an interesting)/i,
    /^(In summary|To summarize|Basically|In conclusion)/i,
    /^(Hope this helps|Let me know|Feel free)/i,
    /^(As an AI|I am|I'm an)/i,
    /^What's got you/i,
    /^Spill the beans/i,
    /^Haha/i,
  ];
  
  // Keep sentences that contain factual content
  const facts = sentences.filter(sentence => {
    // Skip obvious fluff
    if (fluffPatterns.some(p => p.test(sentence))) return false;
    
    // Skip pure questions
    if (sentence.endsWith('?')) return false;
    
    // Skip very short exclamations
    if (sentence.length < 20 && !sentence.includes(' ')) return false;
    
    // Keep sentences with factual indicators
    const hasFactIndicator = /(have|has|are|is|was|were|when|because|their|its|the|octopus|blood|hearts?|swim|pump)/i.test(sentence);
    
    return hasFactIndicator || sentence.length > 30;
  });
  
  // Take top 3-5 facts
  return facts.slice(0, 5);
}

async function storeExtractedFacts(
  facts: string[],
  clerkId: string | null,
  logger: any,
): Promise<{ added: number; skipped: number }> {
  let totalAdded = 0;
  let totalSkipped = 0;
  
  // Use existing trainOnText to store each fact
  for (const fact of facts) {
    try {
      const result = await trainOnText(fact, "llm-teacher", clerkId);
      totalAdded += result.added;
      totalSkipped += result.skipped;
      logger.info({ fact: fact.slice(0, 150), added: result.added, skipped: result.skipped }, "Fact storage result");
    } catch (err) {
      console.warn("Failed to store fact:", fact.slice(0, 100), err);
      totalSkipped++;
    }
  }
  
  return { added: totalAdded, skipped: totalSkipped };
}

// POST /api/omni/chat  — SSE streaming native intelligence chat with optional LLM fallback
// Works for both authenticated users (saves history) and anonymous users (no persistence)
// NOTE: Route is mounted at /chat in omni/index.ts, so we use / here
router.post("/", optionalAuth, async (req, res) => {
  // DEBUG: Log request details
  req.log.info({
    path: req.path,
    url: req.url,
    method: req.method,
    baseUrl: (req as any).baseUrl,
    originalUrl: req.originalUrl,
    body: req.body,
    clerkId: (req as any).clerkId,
    isAuthenticated: !!(req as any).clerkId,
  }, "CHAT ROUTE - Request received");
  const authReq = req as AuthenticatedRequest;
  const { content, conversationId, useLLM } = req.body as {
    content: string;
    conversationId?: number;
    useLLM?: boolean;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  // FIX 3: Detect /hybrid command to force FreeLLM for comprehensive responses
  const isHybridCommand = content.startsWith('/hybrid ');
  const query = isHybridCommand ? content.slice('/hybrid '.length) : content;
  
  // Don't learn from commands themselves
  const shouldSkipLearning = isHybridCommand || content.startsWith('/');

  // Check if user is authenticated
  const clerkId = authReq.clerkId;
  const isAuthenticated = !!clerkId;

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await seedIfEmpty();

    // Load conversation history (only for authenticated users)
    let history: Array<{ role: string; content: string }> = [];
    let convId = conversationId;

    if (isAuthenticated && convId) {
      const hist = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(desc(messages.createdAt))
        .limit(10);
      history = hist
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));
    } else if (isAuthenticated && !convId) {
      // Create a new conversation (only for authenticated users)
      const title = content.slice(0, 60);
      const [conv] = await db
        .insert(conversations)
        .values({
          title,
          mode: "hybrid", // Changed from "native" to "hybrid"
        })
        .returning();
      convId = conv.id;
      sendEvent({ conversationId: convId });
    }
    // Anonymous users: no conversation history, no new conversation created

    // Save user message (only for authenticated users)
    if (isAuthenticated && convId) {
      await db.insert(messages).values({
        conversationId: convId,
        role: "user",
        content: content.trim(),
      });
    }

    const queryText = content.trim();

    // Activity callback — streams search/fetch events to the client in real time
    const onActivity = (event: {
      type: string;
      query?: string;
      url?: string;
      resultCount?: number;
      title?: string;
    }) => {
      if (event.type === "searching") sendEvent({ searching: event.query });
      if (event.type === "fetching") sendEvent({ fetching: event.url });
      if (event.type === "search_done")
        sendEvent({ searchDone: true, resultCount: event.resultCount });
      if (event.type === "fetch_done")
        sendEvent({ fetchDone: true, pageTitle: event.title });
    };

    // Process through brain (native synthesizer)
    const nativeResult = await processMessage(
      query,
      clerkId,
      history,
      onActivity,
    );

    let finalResponse = nativeResult.text;
    let llmResponse = null;

    // TRAINING MODE: Always use FreeLLM for responses, but pass knowledge graph context
    // This gives good responses now while the native AI learns from the interactions
    const isFollowUp = history.length > 0 && 
      (query.toLowerCase().includes("explain more") || 
       query.toLowerCase().includes("tell me more") ||
       query.toLowerCase().includes("what about") ||
       query.toLowerCase().includes("how about"));
    
    // Always use LLM in training mode (week 1), cron will remind to reduce after
    const shouldUseLLM = ALWAYS_USE_LLM || useLLM || isHybridCommand;
    
    if (shouldUseLLM) {
      try {
        // Pass retrieved nodes to FreeLLM as context - gives it knowledge graph awareness
        const llmResult = await callFreeLLM(query, {
          retrievedNodes: nativeResult.nodes, // Pass nodes for context awareness
          systemPrompt: `You are OmniLearn, an AI assistant. Answer conversationally, not like a textbook. Match the user's tone. If they're casual, be casual. If they're serious, be serious.`,
        });
        llmResponse = llmResult.response;
        finalResponse = llmResult.response;
        
        // LOG: What context was passed to LLM
        req.log.info({
          query,
          nodesRetrieved: nativeResult.nodes?.length || 0,
          nodesUsed: nativeResult.nodesUsed,
          topNodeContent: nativeResult.nodes?.[0]?.content?.slice(0, 200),
          topNodeSimilarity: nativeResult.nodes?.[0]?.similarity,
        }, "FreeLLM context details");
        
        // TEACHER MODE: Always extract knowledge from LLM responses during training
        // This builds up the native knowledge graph over time
        if (!isFollowUp) {
          const extractedFacts = extractFactsFromLLMResponse(llmResult.response, query);
          req.log.info({ extractedCount: extractedFacts.length, firstFact: extractedFacts[0]?.slice(0, 150) }, "Extracted facts from LLM response");
          if (extractedFacts.length > 0) {
            storeExtractedFacts(extractedFacts, clerkId, req.log)
              .then(({ added, skipped }) => {
                req.log.info({ added, skipped }, "Stored facts in knowledge graph");
                // Send learning confirmation to frontend
                sendEvent({ 
                  learning: { 
                    extracted: extractedFacts.length,
                    stored: added,
                    message: `Learned ${added} new fact${added === 1 ? '' : 's'} for future!`
                  } 
                });
              })
              .catch(err => {
                req.log.warn({ err }, "Failed to store extracted facts");
                sendEvent({
                  learning: {
                    extracted: extractedFacts.length,
                    stored: 0,
                    message: `Extracted ${extractedFacts.length} facts but storage failed`
                  }
                });
              });
          }
        }
        
        sendEvent({ 
          meta: { 
            useLLM: true, 
            model: llmResult.model, 
            routedVia: llmResult.routedVia,
            hybridMode: isHybridCommand // Indicate /hybrid command was used
          } 
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        req.log.error({ 
          err,
          errorStack: err instanceof Error ? err.stack : undefined,
          message: errorMsg,
          FREELLM_API_URL: process.env.FREELLM_API_URL,
          FREELLM_API_KEY: process.env.FREELLM_API_KEY ? 'SET (length: ' + process.env.FREELLM_API_KEY.length + ')' : 'NOT_SET',
          ALWAYS_USE_LLM: process.env.ALWAYS_USE_LLM,
          shouldUseLLM,
          useLLM,
          isHybridCommand
        }, "FreeLLM API call failed, falling back to native response");
        
        // Send error event to frontend for debugging
        sendEvent({
          error: {
            type: 'freellm_failed',
            message: errorMsg,
            url: process.env.FREELLM_API_URL,
            hasKey: !!process.env.FREELLM_API_KEY
          }
        });
        
        // Fall back to native response
        finalResponse = nativeResult.text;
      }
    }

    // Stream the response token-by-token
    const words = finalResponse.split(/(\s+)/);
    for (const word of words) {
      sendEvent({ content: word });
      const delay = word.match(/[.!?]$/)
        ? 80
        : word.match(/[,;:]$/)
          ? 40
          : word.trim().length === 0
            ? 15
            : 25;
      await new Promise((r) => setTimeout(r, delay));
    }

    // Send metadata event
    sendEvent({
      meta: {
        nodesUsed: nativeResult.nodesUsed,
        newNodesAdded: nativeResult.newNodesAdded,
        character: {
          curiosity: nativeResult.character.curiosity,
          confidence: nativeResult.character.confidence,
          technical: nativeResult.character.technical,
          empathy: nativeResult.character.empathy || 50,
          creativity: nativeResult.character.creativity || 50,
          verbosity: nativeResult.character.verbosity || 50,
        },
        useLLM: shouldUseLLM && llmResponse !== null,
      },
    });

    // Save assistant message (only for authenticated users)
    if (isAuthenticated && convId) {
      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: finalResponse,
      });

      // Log conversation pattern for weekly analysis (only for authenticated users)
      try {
        // Count turns in this conversation
        const turnCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.conversationId, convId));
        const currentTurn = turnCount[0]?.count || 1;

        // Get preceding context (last 3 messages before this one)
        const precedingMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convId))
          .orderBy(desc(messages.createdAt))
          .limit(3);
        const precedingContext = precedingMessages
          .slice(1) // Skip current user message
          .reverse()
          .map((m) => ({ role: m.role, content: m.content }));

        // Classify query type
        let queryType: "question" | "statement" | "command" | "greeting" | "casual" = "question";
        const lowerQuery = query.toLowerCase().trim();
        if (/^(hello|hi|hey|greetings|howdy|good morning|good afternoon|good evening)/.test(lowerQuery)) {
          queryType = "greeting";
        } else if (lowerQuery.includes("?") && !lowerQuery.startsWith("what") && !lowerQuery.startsWith("how") && !lowerQuery.startsWith("why") && !lowerQuery.startsWith("when") && !lowerQuery.startsWith("where") && !lowerQuery.startsWith("who")) {
          queryType = "statement";
        } else if (lowerQuery.match(/^(show|tell|find|search|list|get|create|update|delete|remove|add|open|close|start|stop|run|execute)/)) {
          queryType = "command";
        } else if (lowerQuery.length < 15 && !lowerQuery.includes("?") && !lowerQuery.includes("!")) {
          queryType = "casual";
        }

        await db.insert(chatPatterns).values({
          conversationId: convId,
          turnNumber: currentTurn,
          query,
          queryType,
          precedingContext,
          nodesRetrieved: nativeResult.nodes?.length || 0,
          avgSimilarity: nativeResult.nodes?.length > 0
            ? nativeResult.nodes.reduce((sum, n) => sum + n.similarity, 0) / nativeResult.nodes.length
            : null,
          topNodeContent: nativeResult.nodes?.[0]?.content || null,
          responseLength: finalResponse.length,
          nodesUsed: nativeResult.nodesUsed,
          newNodesAdded: nativeResult.newNodesAdded,
          useLLM: shouldUseLLM && llmResponse !== null,
        });

        // Learn from chat response (skip commands and hybrid failures)
        if (!shouldSkipLearning) {
          trainOnText(finalResponse, "chat-response", clerkId).catch((err) => {
            req.log.warn({ err }, "Failed to learn from chat response");
          });
        }

        // Log training data
        try {
          await db.insert(trainingLogs).values({
            query,
            retrievedNodes: nativeResult.nodes?.map((n) => ({
              content: n.content,
              similarity: n.similarity,
            })) || [],
            responseType: shouldUseLLM && llmResponse !== null ? "hybrid" : "native",
            nativeResponse: nativeResult.text,
            llmResponse,
            finalResponse,
            nodesUsed: nativeResult.nodesUsed,
            avgSimilarity: nativeResult.nodes?.length > 0
              ? nativeResult.nodes.reduce((sum, n) => sum + n.similarity, 0) / nativeResult.nodes.length
              : null,
            characterState: {
              curiosity: nativeResult.character.curiosity,
              confidence: nativeResult.character.confidence,
              technical: nativeResult.character.technical,
              empathy: nativeResult.character.empathy || 50,
              creativity: nativeResult.character.creativity || 50,
              verbosity: nativeResult.character.verbosity || 50,
            },
            conversationId: convId,
            userReplied: false, // Will be updated when user replies
            conversationTurns: 1,
          });
        } catch (err) {
          req.log.warn({ err }, "Failed to log training data");
        }
      } catch (err) {
        req.log.warn({ err }, "Failed to log chat pattern");
      }
    } else {
      // Anonymous users: still learn from responses but don't persist
      if (!shouldSkipLearning) {
        trainOnText(finalResponse, "chat-response", null).catch((err) => {
          req.log.warn({ err }, "Failed to learn from anonymous chat response");
        });
      }
    }

    sendEvent({ done: true, conversationId: convId });
  } catch (err) {
    req.log.error(
      {
        err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      "Brain processing error",
    );
    sendEvent({ error: "Internal brain error", done: true });
  } finally {
    res.end();
  }
});

// Helper for AND conditions
import { and } from "drizzle-orm";

// GET /api/omni/chat/engagement/:conversationId — Update engagement tracking
router.get("/engagement/:conversationId", async (req, res) => {
  const { conversationId } = req.params as { conversationId: string };
  const convId = parseInt(conversationId, 10);

  try {
    // Get last message
    const lastMessage = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (lastMessage.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Check if there's a follow-up query (user replied)
    const userMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.createdAt));

    const userReplied = userMessages.length > 1;
    const followUpQuery = userReplied ? userMessages[1].content : null;
    const conversationTurns = userMessages.length;

    // Update training log
    await db
      .update(trainingLogs)
      .set({
        userReplied,
        followUpQuery,
        conversationTurns,
      })
      .where(eq(trainingLogs.conversationId, convId));

    // Update chat pattern with engagement data
    if (userReplied && userMessages.length >= 2) {
      const previousAssistantMessage = userMessages.find(m => m.role === 'assistant');
      if (previousAssistantMessage) {
        const timeToNextQuery = userMessages[1].createdAt.getTime() - previousAssistantMessage.createdAt.getTime();
        
        await db
          .update(chatPatterns)
          .set({
            userReplied: true,
            timeToNextQueryMs: timeToNextQuery,
          })
          .where(
            and(
              eq(chatPatterns.conversationId, convId),
              eq(chatPatterns.turnNumber, conversationTurns - 1)
            )
          );
      }
    }

    res.json({
      userReplied,
      followUpQuery,
      conversationTurns,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update engagement tracking");
    res.status(500).json({ error: "Failed to update engagement" });
  }
});

export default router;
