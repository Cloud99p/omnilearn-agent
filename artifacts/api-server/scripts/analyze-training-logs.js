/**
 * Training Analysis Script
 * 
 * Analyzes training_logs to identify patterns and generate improvement suggestions
 * for the native synthesizer.
 * 
 * Run weekly: node scripts/analyze-training-logs.js
 */

import { db } from "@workspace/db";
import { trainingLogs } from "@workspace/db/schema";
import { and, eq, gte, lt, desc, sql } from "drizzle-orm";
import { callFreeLLM, scoreResponse } from "../src/lib/free-llm.js";

async function analyzeTrainingLogs() {
  console.log("📊 Analyzing training logs...");

  // Get all logs from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const logs = await db
    .select()
    .from(trainingLogs)
    .where(gte(trainingLogs.createdAt, sevenDaysAgo))
    .orderBy(desc(trainingLogs.createdAt));

  console.log(`Found ${logs.length} training logs`);

  if (logs.length === 0) {
    console.log("No logs found. Start chatting to generate data!");
    return;
  }

  // 1. Response type distribution
  const responseTypeCounts = logs.reduce((acc, log) => {
    acc[log.responseType] = (acc[log.responseType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\n📈 Response Type Distribution:");
  Object.entries(responseTypeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${Math.round((count / logs.length) * 100)}%)`);
  });

  // 2. Engagement analysis
  const engagedLogs = logs.filter((log) => log.userReplied);
  const engagementRate = engagedLogs.length / logs.length;

  console.log(`\n💬 Engagement Rate: ${(engagementRate * 100).toFixed(1)}% (${engagedLogs.length}/${logs.length})`);

  // 3. Low-engagement queries (no follow-up)
  const lowEngagementLogs = logs.filter((log) => !log.userReplied);
  if (lowEngagementLogs.length > 0) {
    console.log("\n🔍 Low-Engagement Queries (no follow-up):");
    lowEngagementLogs.slice(0, 5).forEach((log) => {
      console.log(`  - "${log.query}"`);
      console.log(`    Response type: ${log.responseType}`);
      console.log(`    Nodes used: ${log.nodesUsed}`);
      console.log("");
    });
  }

  // 4. Analyze native vs LLM performance (if you have engagement data)
  const nativeLogs = logs.filter((log) => log.responseType === "native");
  const hybridLogs = logs.filter((log) => log.responseType === "hybrid");

  const nativeEngagement = nativeLogs.filter((log) => log.userReplied).length / nativeLogs.length;
  const hybridEngagement = hybridLogs.filter((log) => log.userReplied).length / hybridLogs.length;

  console.log("\n🎯 Engagement by Response Type:");
  console.log(`  Native: ${(nativeEngagement * 100).toFixed(1)}%`);
  console.log(`  Hybrid: ${(hybridEngagement * 100).toFixed(1)}%`);

  // 5. Generate improvement suggestions using LLM
  console.log("\n🤖 Generating improvement suggestions...");

  const suggestionPrompt = `Analyze these OmniLearn training logs and suggest improvements for the native synthesizer:

Response type distribution: ${JSON.stringify(responseTypeCounts)}
Engagement rate: ${(engagementRate * 100).toFixed(1)}%

Low-engagement queries (users didn't follow up):
${lowEngagementLogs.slice(0, 10).map((log) => `- Query: "${log.query}"\n  Response type: ${log.responseType}\n  Nodes used: ${log.nodesUsed}\n`).join("")}

Native vs Hybrid engagement:
- Native: ${(nativeEngagement * 100).toFixed(1)}%
- Hybrid: ${(hybridEngagement * 100).toFixed(1)}%

Suggest specific improvements for the native synthesizer:
1. What response patterns are missing?
2. What topics need better handling?
3. What tone adjustments would help?
4. Should we increase/decrease LLM fallback rate?

Be specific and actionable.
`;

  try {
    const llmResponse = await callFreeLLM(suggestionPrompt, {
      systemPrompt: "You are an AI training analyst. Analyze data and provide specific, actionable recommendations for improving a chatbot's native response synthesizer.",
    });

    console.log("\n💡 Suggested Improvements:");
    console.log(llmResponse.response);
  } catch (err) {
    console.warn("⚠️ Could not generate LLM suggestions:", err.message);
  }

  // 6. Export data for deeper analysis
  const exportData = {
    summary: {
      totalLogs: logs.length,
      engagementRate,
      responseTypeCounts,
      nativeEngagement,
      hybridEngagement,
      dateRange: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
    },
    lowEngagementQueries: lowEngagementLogs.slice(0, 20).map((log) => ({
      query: log.query,
      responseType: log.responseType,
      nodesUsed: log.nodesUsed,
      avgSimilarity: log.avgSimilarity,
    })),
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "training-analysis-export.json",
    JSON.stringify(exportData, null, 2),
  );

  console.log("\n📁 Exported analysis to training-analysis-export.json");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeTrainingLogs().catch((err) => {
    console.error("Analysis failed:", err);
    process.exit(1);
  });
}
