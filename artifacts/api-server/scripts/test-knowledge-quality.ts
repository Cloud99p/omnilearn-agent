/**
 * Test script for knowledge quality validation
 * Run with: pnpm tsx scripts/test-knowledge-quality.ts
 */

import { hasKnowledgeQuality } from "../src/brain/extractor.js";

console.log("🧪 Testing Knowledge Quality Validation\n");
console.log("=".repeat(60));

const testCases = [
  // SHOULD REJECT (low quality, garbage, truncated)
  { input: "is a n open", quality: false, reason: "broken grammar" },
  {
    input: "omnilearn is a n open",
    quality: false,
    reason: "broken grammar (is a n)",
  },
  { input: "the the database", quality: false, reason: "repeated words" },
  { input: "PET classifier", quality: false, reason: "too short (< 25 chars)" },
  {
    input:
      "From a visual inspection we see that both OmniLearn and the PET classifier reweight the distributions to achieve better agreement with the data on high-level observables.",
    quality: false,
    reason: "research paper language, too long",
  },
  {
    input: "I'm working on a new feature",
    quality: false,
    reason: "AI shouldn't claim to work on features",
  },
  {
    input: "fig. 3 shows the results",
    quality: false,
    reason: "figure reference",
  },
  {
    input: "table 2 summarizes [1]",
    quality: false,
    reason: "table reference + citation",
  },
  { input: "et al. demonstrated", quality: false, reason: "academic citation" },
  { input: "AAAAAAAAAA", quality: false, reason: "no lowercase letters" },

  // SHOULD ACCEPT (good quality facts)
  {
    input: "OmniLearn is an open-source AI agent.",
    quality: true,
    reason: "proper fact",
  },
  {
    input: "TypeScript is better than JavaScript for large projects.",
    quality: true,
    reason: "opinion/fact",
  },
  {
    input: "The database uses PostgreSQL on Supabase.",
    quality: true,
    reason: "technical fact",
  },
  {
    input: "Emmanuel Nenpan Hosea created OmniLearn.",
    quality: true,
    reason: "creator fact",
  },
  {
    input: "I use GitHub with the username Cloud99p.",
    quality: true,
    reason: "user fact",
  },
  {
    input: "OmniLearn has a persistent knowledge graph.",
    quality: true,
    reason: "feature fact",
  },
  {
    input: "The API server runs on Railway.",
    quality: true,
    reason: "deployment fact",
  },
];

let passed = 0;
let failed = 0;

for (const { input, quality: shouldPass, reason } of testCases) {
  const passes = hasKnowledgeQuality(input);
  const success = passes === shouldPass;

  if (success) {
    console.log(`✅ "${input}"`);
    console.log(`   → ${shouldPass ? "Accepted" : "Rejected"} (${reason})`);
    passed++;
  } else {
    console.log(`❌ "${input}"`);
    console.log(
      `   → Expected: ${shouldPass ? "accept" : "reject"}, got: ${passes ? "accept" : "reject"}`,
    );
    console.log(`   → Reason: ${reason}`);
    failed++;
  }
  console.log();
}

console.log("=".repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log("✅ All quality validation tests passed!\n");
  console.log("🎯 Knowledge quality filters will now:");
  console.log("   - Reject truncated/garbage text");
  console.log("   - Reject broken grammar (is a n, the the)");
  console.log("   - Reject research paper language");
  console.log("   - Reject academic citations");
  console.log("   - Accept proper facts and statements\n");
  process.exit(0);
} else {
  console.log("⚠️  Some tests failed - review quality logic\n");
  process.exit(1);
}
