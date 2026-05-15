/**
 * Test script for question/command filtering
 * Run with: pnpm tsx scripts/test-question-filtering.ts
 */

import { extractFacts, detectQueryType } from "../src/brain/extractor.js";

console.log("🧪 Testing Question/Command Filtering\n");
console.log("=".repeat(60));

const testCases = [
  // SHOULD NOT EXTRACT (questions, commands, requests)
  {
    input: "i dont understand, explain it more clearly",
    shouldExtract: false,
    reason: "clarification request",
  },
  {
    input: "I don't understand",
    shouldExtract: false,
    reason: "understanding statement",
  },
  { input: "explain what you mean", shouldExtract: false, reason: "command" },
  { input: "can you explain this?", shouldExtract: false, reason: "question" },
  { input: "tell me about OmniLearn", shouldExtract: false, reason: "request" },
  { input: "what is OmniLearn?", shouldExtract: false, reason: "question" },
  { input: "how does it work?", shouldExtract: false, reason: "question" },
  { input: "help me understand", shouldExtract: false, reason: "help request" },
  { input: "clarify this", shouldExtract: false, reason: "command" },
  { input: "show me an example", shouldExtract: false, reason: "command" },
  {
    input: "I'm confused",
    shouldExtract: false,
    reason: "confusion statement",
  },
  { input: "hello", shouldExtract: false, reason: "greeting" },
  { input: "thanks", shouldExtract: false, reason: "gratitude" },
  {
    input: "let's talk about AI",
    shouldExtract: false,
    reason: "meta-conversation",
  },
  {
    input: "quick question",
    shouldExtract: false,
    reason: "meta-conversation",
  },

  // SHOULD EXTRACT (actual facts/statements)
  {
    input: "OmniLearn is an open-source AI agent",
    shouldExtract: true,
    reason: "declarative fact",
  },
  {
    input: "TypeScript is better than JavaScript",
    shouldExtract: true,
    reason: "opinion/fact",
  },
  {
    input: "I use GitHub with username Cloud99p",
    shouldExtract: true,
    reason: "user fact",
  },
  {
    input: "The database uses PostgreSQL",
    shouldExtract: true,
    reason: "technical fact",
  },
  {
    input: "OmniLearn was created by Emmanuel",
    shouldExtract: true,
    reason: "creator fact",
  },
];

let passed = 0;
let failed = 0;

for (const { input, shouldExtract, reason } of testCases) {
  const facts = extractFacts(input);
  const hasFacts = facts.length > 0;
  const success = hasFacts === shouldExtract;

  if (success) {
    console.log(`✅ "${input}"`);
    console.log(`   → ${shouldExtract ? "Extracted" : "Skipped"} (${reason})`);
    passed++;
  } else {
    console.log(`❌ "${input}"`);
    console.log(
      `   → Expected: ${shouldExtract ? "extract" : "skip"}, got: ${hasFacts ? "extract" : "skip"}`,
    );
    console.log(`   → Reason: ${reason}`);
    if (facts.length > 0) {
      console.log(
        `   → Extracted: ${facts.map((f) => f.content.slice(0, 50)).join(", ")}...`,
      );
    }
    failed++;
  }
  console.log();
}

console.log("=".repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log("✅ All filtering tests passed!\n");
  process.exit(0);
} else {
  console.log("⚠️  Some tests failed - review the filtering logic\n");
  process.exit(1);
}
