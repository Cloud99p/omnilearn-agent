#!/usr/bin/env tsx
/**
 * Export chat logs for training analysis
 * 
 * Usage: tsx scripts/export-chat-logs.ts [--limit 100] [--output chat-logs.json]
 */

import { db } from "../lib/db/src/index.js";
import { messages } from "../lib/db/src/schema/messages.js";
import { conversations } from "../lib/db/src/schema/conversations.js";
import { eq, desc, asc } from "drizzle-orm";
import { writeFileSync } from "fs";
import { join } from "path";

// Parse command line args
const args = process.argv.slice(2);
const limitIndex = args.indexOf("--limit");
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 200;

const outputIndex = args.indexOf("--output");
const outputFile = outputIndex !== -1 
  ? args[outputIndex + 1] 
  : join(process.cwd(), "chat-logs.json");

console.log(`Exporting up to ${limit} conversations...`);

async function exportChatLogs() {
  try {
    // Get recent conversations
    const recentConvs = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(limit);

    console.log(`Found ${recentConvs.length} conversations`);

    const exportData: Array<{
      conversationId: number;
      createdAt: Date;
      messageCount: number;
      messages: Array<{
        role: "user" | "assistant";
        content: string;
        timestamp: Date;
      }>;
    }> = [];

    for (const conv of recentConvs) {
      // Get all messages for this conversation
      const convMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.createdAt));

      if (convMessages.length === 0) continue;

      exportData.push({
        conversationId: conv.id,
        createdAt: conv.createdAt,
        messageCount: convMessages.length,
        messages: convMessages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.createdAt,
        })),
      });
    }

    // Write to file
    writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
    
    console.log(`\n✅ Exported ${exportData.length} conversations to ${outputFile}`);
    console.log(`Total messages: ${exportData.reduce((sum, c) => sum + c.messageCount, 0)}`);
    
    // Generate summary
    console.log("\n📊 Quick Summary:");
    const totalMessages = exportData.reduce((sum, c) => sum + c.messageCount, 0);
    const avgLength = totalMessages / exportData.length;
    console.log(`  - Average messages per conversation: ${avgLength.toFixed(1)}`);
    console.log(`  - Shortest conversation: ${Math.min(...exportData.map(c => c.messageCount))} messages`);
    console.log(`  - Longest conversation: ${Math.max(...exportData.map(c => c.messageCount))} messages`);
    
  } catch (err) {
    console.error("Error exporting chat logs:", err);
    process.exit(1);
  }
}

exportChatLogs();
