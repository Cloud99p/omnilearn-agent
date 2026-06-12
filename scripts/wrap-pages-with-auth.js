#!/usr/bin/env node
/**
 * Wrap protected pages with RequireAuth component
 * Usage: node scripts/wrap-pages-with-auth.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(__dirname, '../artifacts/omnilearn/src/pages');

// Pages that require authentication (show personal data)
const PROTECTED_PAGES = [
  'intelligence.tsx',
  'personality.tsx',
  'dna.tsx',
  'memory.tsx',
  'architecture.tsx',
  'governance.tsx',
  'compare.tsx',
  'network.tsx',
  'ghost-network.tsx',
  'account.tsx',
  'teams.tsx',
  'audit-logs.tsx',
  'storage.tsx',
  'repositories.tsx',
  'configuration.tsx',
  'modes.tsx',
  'compliance.tsx',
  'ingestion.tsx',
  'smarter.tsx',
];

function wrapPage(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  
  // Check if already wrapped
  if (content.includes('RequireAuth')) {
    console.log(`⏭️  ${filePath} - Already has RequireAuth`);
    return false;
  }
  
  // Add import
  const importLine = 'import { RequireAuth } from "@/components/require-auth";';
  if (!content.includes('import { RequireAuth')) {
    // Find first import line and add after it
    const firstImportMatch = content.match(/^(import .+;)/m);
    if (firstImportMatch) {
      content = content.replace(firstImportMatch[0], `${firstImportMatch[0]}\n${importLine}`);
    }
  }
  
  // Find export default function
  const exportMatch = content.match(/export default function (\w+)\(/);
  if (!exportMatch) {
    console.log(`⚠️  ${filePath} - No export default function found`);
    return false;
  }
  
  const originalFuncName = exportMatch[1];
  const contentFuncName = `${originalFuncName}Content`;
  
  // Rename the function
  content = content.replace(
    `export default function ${originalFuncName}(`,
    `function ${contentFuncName}(`
  );
  
  // Find the closing of the function and add wrapper
  // Look for the last closing brace before the end of file
  const lastBraceMatch = content.match(/\n\}\n?$/);
  if (lastBraceMatch) {
    const wrapper = `}\n\nexport default function ${originalFuncName}() {\n  return (\n    <RequireAuth>\n      <${contentFuncName} />\n    </RequireAuth>\n  );\n}\n`;
    content = content.replace(/\n\}\n?$/, wrapper);
  }
  
  writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ ${filePath} - Wrapped with RequireAuth`);
  return true;
}

// Process all protected pages
let count = 0;
PROTECTED_PAGES.forEach(page => {
  const filePath = join(pagesDir, page);
  try {
    if (wrapPage(filePath)) count++;
  } catch (err) {
    console.error(`❌ ${page} - Error: ${err.message}`);
  }
});

console.log(`\n🎉 Done! Wrapped ${count} pages with RequireAuth`);
