/**
 * Test script for identity detection
 * Run with: pnpm tsx scripts/test-identity-detection.ts
 */

import { detectIdentityStatement, extractFacts } from "../src/brain/extractor.js";

const testCases = [
  // Should detect identity
  { input: "I'm Emmanuel", expected: "Emmanuel" },
  { input: "I am Emmanuel", expected: "Emmanuel" },
  { input: "My name is Emmanuel", expected: "Emmanuel" },
  { input: "Call me Emmanuel", expected: "Emmanuel" },
  { input: "I go by Emmanuel", expected: "Emmanuel" },
  { input: "I'm John Smith", expected: "John Smith" },
  { input: "My name is Alice Johnson", expected: "Alice Johnson" },
  
  // Should NOT detect identity (AI talking about itself or common phrases)
  { input: "I am Omni", expected: null },  // AI name, not user
  { input: "I'm the assistant", expected: null },
  { input: "I am an AI", expected: null },
  
  // Should NOT detect (not identity statements)
  { input: "I am learning about AI", expected: null },
  { input: "I am happy today", expected: null },
  { input: "The sky is blue", expected: null },
  { input: "What is my name?", expected: null },
];

console.log("🧪 Testing Identity Detection\n");
console.log("=" .repeat(60));

let passed = 0;
let failed = 0;

for (const { input, expected } of testCases) {
  const result = detectIdentityStatement(input);
  const success = result === expected;
  
  if (success) {
    console.log(`✅ "${input}"`);
    console.log(`   → ${result ?? "null (correct)"}`);
    passed++;
  } else {
    console.log(`❌ "${input}"`);
    console.log(`   → Expected: ${expected ?? "null"}`);
    console.log(`   → Got: ${result ?? "null"}`);
    failed++;
  }
  console.log();
}

console.log("=" .repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

// Test fact extraction
console.log("🧪 Testing Fact Extraction\n");
console.log("=" .repeat(60));

const factTests = [
  { input: "I'm Emmanuel", shouldExtract: true, type: "identity" },
  { input: "The sky is blue", shouldExtract: true, type: "fact" },
  { input: "What is AI?", shouldExtract: false },
  { input: "I am Omni", shouldExtract: false },  // AI self-identity should NOT be stored as user identity
];

for (const { input, shouldExtract, type } of factTests) {
  const facts = extractFacts(input);
  const hasFacts = facts.length > 0;
  const correctType = type ? facts.some(f => f.type === type) : true;
  const success = hasFacts === shouldExtract && correctType;
  
  if (success) {
    console.log(`✅ "${input}"`);
    if (facts.length > 0) {
      console.log(`   → ${facts.length} fact(s): [${facts.map(f => f.type).join(", ")}]`);
    }
  } else {
    console.log(`❌ "${input}"`);
    console.log(`   → Expected extract: ${shouldExtract}, got: ${hasFacts}`);
    if (type) {
      console.log(`   → Expected type: ${type}, got: ${facts.map(f => f.type).join(", ")}`);
    }
  }
  console.log();
}

console.log("=" .repeat(60));
console.log(`\n${failed === 0 ? "✅ All tests passed!" : "⚠️  Some tests failed"}\n`);

process.exit(failed > 0 ? 1 : 0);
