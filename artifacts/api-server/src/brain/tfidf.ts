const STOPWORDS = new Set([
  "the","a","an","is","it","in","on","at","to","for","of","and","or","but","with","by",
  "from","that","this","are","was","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","can","shall","i","you","he",
  "she","we","they","me","him","her","us","them","my","your","his","its","our","their",
  "what","which","who","how","when","where","why","not","no","so","if","then","than",
  "just","also","about","into","up","out","as","more","some","all","any","there","here",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/g, " ")
    .split(/[\s\-_]+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

export function termFrequency(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const token of tokens) {
    tf[token] = (tf[token] ?? 0) + 1;
  }
  const total = tokens.length || 1;
  for (const token in tf) {
    tf[token] /= total;
  }
  return tf;
}

export function computeIdfFromVectors(vectors: Array<Record<string, number>>): Record<string, number> {
  const N = vectors.length || 1;
  const docFreq: Record<string, number> = {};
  for (const vec of vectors) {
    for (const term in vec) {
      docFreq[term] = (docFreq[term] ?? 0) + 1;
    }
  }
  const idf: Record<string, number> = {};
  for (const term in docFreq) {
    idf[term] = Math.log((N + 1) / (docFreq[term] + 1)) + 1;
  }
  return idf;
}

export function buildTfidfVector(
  tokens: string[],
  idf: Record<string, number>,
): Record<string, number> {
  const tf = termFrequency(tokens);
  const vector: Record<string, number> = {};
  for (const term in tf) {
    vector[term] = tf[term] * (idf[term] ?? 1.0);
  }
  return vector;
}

export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const term in a) {
    dot += a[term] * (b[term] ?? 0);
    magA += a[term] * a[term];
  }
  for (const term in b) {
    magB += b[term] * b[term];
  }

  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

export function queryScore(
  queryTokens: string[],
  nodeTokens: string[],
  nodeVector: Record<string, number>,
  allVectors: Array<Record<string, number>>,
): number {
  const idf = computeIdfFromVectors(allVectors);
  const queryVec = buildTfidfVector(queryTokens, idf);
  const base = cosineSimilarity(queryVec, nodeVector);

  // Boost exact term matches
  const nodeSet = new Set(nodeTokens);
  const matchCount = queryTokens.filter(t => nodeSet.has(t)).length;
  const exactBoost = matchCount / (queryTokens.length || 1) * 0.2;

  return Math.min(1, base + exactBoost);
}
