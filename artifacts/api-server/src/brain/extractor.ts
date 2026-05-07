export interface ExtractedFact {
  content: string;
  type: "fact" | "concept" | "opinion" | "rule";
  tags: string[];
  confidence: number;
}

const FACT_PATTERNS: Array<{ re: RegExp; type: ExtractedFact["type"]; conf: number }> = [
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:is|are)\s+(?:a|an|the|one of)?\s*([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.75 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:means?|refers? to|stands? for)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.80 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:can|could|enables?|allows?)\s+([\w][\w\s,]{2,60})/gi, type: "rule", conf: 0.70 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:causes?|leads? to|results? in|produces?)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.75 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:uses?|employs?|relies? on|requires?)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.70 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:consists? of|contains?|includes?|has)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.70 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:was|were)\s+(?:designed?|built?|created?|developed?)\s+(?:to|for|by)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.72 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:works?|operates?|functions?|runs?)\s+(?:by|through|via|on)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.68 },
];

export function extractFacts(text: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  // Don't extract facts from questions - they're prompts, not knowledge!
  const trimmed = text.trim();
  if (trimmed.endsWith("?") || /^(what|who|where|when|why|how|is|are|can|could|does|do|will|would|should|tell|explain|describe)/i.test(trimmed)) {
    return facts; // Return empty - no fact extraction from questions
  }

  for (const { re, type, conf } of FACT_PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const subj = match[1]?.trim().toLowerCase().replace(/\s+/g, " ");
      const obj = match[2]?.trim().toLowerCase().replace(/\s+/g, " ");

      if (!subj || !obj) continue;
      if (subj.split(" ").length > 8 || obj.split(" ").length > 10) continue;
      if (subj.length < 3 || obj.length < 3) continue;

      const key = `${subj}::${obj}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const content = `${subj} ${match[0].slice(subj.length, match[0].indexOf(obj)).trim()} ${obj}`.trim();
      const tags = extractTags([subj, obj]);

      facts.push({ content, type, tags, confidence: conf });
    }
  }

  // Also capture the whole sentence as a general knowledge node if long enough
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 300);
  for (const sentence of sentences) {
    const normalised = sentence.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(`sent::${normalised}`)) {
      seen.add(`sent::${normalised}`);
      facts.push({
        content: sentence.trim(),
        type: "fact",
        tags: extractTags(sentence.split(/\s+/).slice(0, 5)),
        confidence: 0.6,
      });
    }
  }

  return facts.slice(0, 20);
}

export function extractTags(words: string[]): string[] {
  return words
    .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(w => w.length > 3)
    .slice(0, 8);
}

export function detectQueryType(text: string): "question" | "statement" | "command" {
  const trimmed = text.trim();
  if (trimmed.endsWith("?") || /^(what|who|where|when|why|how|is|are|can|could|does|do|will|would|should|tell|explain|describe)/i.test(trimmed)) {
    return "question";
  }
  if (/^(teach|learn|remember|know|store|add|save|update|forget)/i.test(trimmed)) {
    return "command";
  }
  return "statement";
}

export function extractKeyTerms(text: string): string[] {
  // Extract multi-word proper nouns and key concepts
  const terms: string[] = [];

  // Capitalized phrases (likely proper nouns / named concepts)
  const caps = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) ?? [];
  terms.push(...caps.map(t => t.toLowerCase()));

  // Words after "about", "regarding", "on", "concerning"
  const topicMatch = text.match(/(?:about|regarding|on|concerning|understand|know about|tell me about)\s+([a-z][\w\s]{2,30})/gi);
  if (topicMatch) {
    for (const m of topicMatch) {
      const t = m.replace(/^(about|regarding|on|concerning|understand|know about|tell me about)\s+/i, "").trim();
      if (t) terms.push(t.toLowerCase());
    }
  }

  return [...new Set(terms)].slice(0, 10);
}
