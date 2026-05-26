/**
 * Advanced Learning Pipeline for OmniLearn
 * Improves how knowledge is extracted, validated, and stored from conversations
 * 
 * Features:
 * - Multi-stage fact validation
 * - Contradiction detection
 * - Knowledge consolidation (merge duplicates)
 * - Learning quality scoring
 * - Active learning (ask clarifying questions)
 * - Knowledge lifecycle management
 */

import { extractFacts, hasKnowledgeQuality } from './extractor.js';
import { logger } from '../lib/logger.js';

export interface LearningContext {
  clerkId: string | null;
  sessionId?: string;
  source: 'conversation' | 'train' | 'document' | 'web' | 'session';
  previousKnowledge?: Array<{
    content: string;
    type: string;
    tags: string[];
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  quality: number; // 0-1
  issues: string[];
  suggestions: string[];
  confidence: number;
}

export interface ConsolidatedFact {
  content: string;
  type: string;
  tags: string[];
  confidence: number;
  sources: string[];
  mergedFrom: number[]; // IDs of merged facts
  reason: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage 1: Pre-Learning Validation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validate fact before learning
 * Checks for quality, contradictions, and duplicates
 */
export async function validateFactForLearning(
  content: string,
  type: string,
  context: LearningContext
): Promise<ValidationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // 1. Quality check
  const hasQuality = hasKnowledgeQuality(content);
  if (!hasQuality) {
    issues.push('Low knowledge quality (too short, incomplete, or conversational)');
    suggestions.push('Provide more complete, factual statements');
  }
  
  // 2. Check for contradictions with existing knowledge
  if (context.previousKnowledge && context.previousKnowledge.length > 0) {
    const contradictions = detectContradictions(content, context.previousKnowledge);
    if (contradictions.length > 0) {
      issues.push(`Contradicts ${contradictions.length} existing fact(s)`);
      suggestions.push('Review conflicting knowledge and resolve contradictions');
    }
  }
  
  // 3. Check for duplicates
  const duplicates = findDuplicates(content, context.previousKnowledge || []);
  if (duplicates.length > 0) {
    issues.push(`Similar to ${duplicates.length} existing fact(s)`);
    suggestions.push('Consider consolidating with existing knowledge');
  }
  
  // 4. Check for agency claims (AI shouldn't claim personal experiences)
  const agencyPatterns = [
    /i['']?m working on/i,
    /i['']?m building/i,
    /i['']?m developing/i,
    /i will (add|implement|create|build)/i,
    /my (feature|project|goal|plan)/i,
  ];
  
  if (agencyPatterns.some(p => p.test(content))) {
    issues.push('Contains agency claims (AI claiming personal work)');
    suggestions.push('Rephrase as general knowledge, not personal experience');
  }
  
  // 5. Calculate quality score
  const qualityScore = calculateLearningQuality(content, type, issues.length);
  
  // 6. Determine if valid
  const isValid = hasQuality && issues.length <= 1 && qualityScore >= 0.5;
  
  return {
    isValid,
    quality: qualityScore,
    issues,
    suggestions,
    confidence: isValid ? 0.8 : 0.5,
  };
}

/**
 * Detect contradictions between new and existing knowledge
 */
function detectContradictions(
  newFact: string,
  existingFacts: Array<{ content: string; type: string }>
): Array<{ fact: string; reason: string }> {
  const contradictions: Array<{ fact: string; reason: string }> = [];
  
  // Simple contradiction patterns
  const contradictionPatterns: Array<{
    pattern: RegExp;
    opposite: RegExp;
  }> = [
    { pattern: /\b(always|never|all|none)\b/i, opposite: /\b(sometimes|often|some|many)\b/i },
    { pattern: /\b(is|are)\b/i, opposite: /\b(is not|are not|isn't|aren't)\b/i },
    { pattern: /\b(better than)\b/i, opposite: /\b(worse than|inferior to)\b/i },
    { pattern: /\b(works with|compatible with)\b/i, opposite: /\b(doesn't work with|incompatible with)\b/i },
    { pattern: /\b(requires|needs)\b/i, opposite: /\b(doesn't require|optional)\b/i },
  ];
  
  for (const existing of existingFacts) {
    for (const { pattern, opposite } of contradictionPatterns) {
      const hasPattern = pattern.test(newFact);
      const hasOpposite = opposite.test(existing.content);
      
      // Check if topics are similar
      const newTopics = extractTopics(newFact);
      const existingTopics = extractTopics(existing.content);
      const topicOverlap = newTopics.filter(t => existingTopics.includes(t)).length;
      
      if (hasPattern && hasOpposite && topicOverlap >= 2) {
        contradictions.push({
          fact: existing.content,
          reason: `Contradictory claims about ${newTopics.join(', ')}`,
        });
      }
    }
  }
  
  return contradictions;
}

/**
 * Find duplicate or near-duplicate facts
 */
function findDuplicates(
  newFact: string,
  existingFacts: Array<{ content: string }>
): Array<{ fact: string; similarity: number }> {
  const duplicates: Array<{ fact: string; similarity: number }> = [];
  
  const newFactNormalized = newFact.toLowerCase().replace(/\s+/g, ' ').trim();
  const newFactWords = new Set(newFactNormalized.split(' '));
  
  for (const existing of existingFacts) {
    const existingNormalized = existing.content.toLowerCase().replace(/\s+/g, ' ').trim();
    const existingWords = new Set(existingNormalized.split(' '));
    
    // Calculate Jaccard similarity
    const intersection = [...newFactWords].filter(w => existingWords.has(w)).length;
    const union = new Set([...newFactWords, ...existingWords]).size;
    const similarity = union > 0 ? intersection / union : 0;
    
    if (similarity > 0.7) { // High similarity threshold
      duplicates.push({
        fact: existing.content,
        similarity,
      });
    }
  }
  
  return duplicates;
}

/**
 * Extract topics from fact for comparison
 */
function extractTopics(fact: string): string[] {
  // Extract capitalized words (likely proper nouns / key concepts)
  const capitalized = fact.match(/\b[A-Z][a-z]+\b/g) || [];
  
  // Extract nouns (simple heuristic: words after articles/prepositions)
  const afterArticles = fact.match(/(?:a|an|the|of|for|with|about)\s+(\w+)/gi) || [];
  const nouns = afterArticles.map(m => m.split(/\s+/)[1]);
  
  // Combine and deduplicate
  const topics = [...capitalized, ...nouns]
    .map(t => t.toLowerCase())
    .filter(t => t.length > 3)
    .slice(0, 5);
  
  return [...new Set(topics)];
}

/**
 * Calculate learning quality score
 */
function calculateLearningQuality(content: string, type: string, issueCount: number): number {
  let score = 1.0;
  
  // Length factor (0-0.3)
  const lengthScore = Math.min(0.3, content.length / 300);
  
  // Type factor (0-0.2)
  const typeScores: Record<string, number> = {
    'fact': 0.2,
    'concept': 0.15,
    'rule': 0.15,
    'identity': 0.2,
    'opinion': 0.1,
  };
  const typeScore = typeScores[type] || 0.1;
  
  // Issue penalty (0 to -0.5)
  const issuePenalty = Math.min(0.5, issueCount * 0.15);
  
  score = lengthScore + typeScore - issuePenalty;
  
  return Math.max(0, Math.min(1, score));
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage 2: Knowledge Consolidation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Consolidate duplicate/similar facts into unified knowledge
 */
export function consolidateFacts(
  facts: Array<{
    id?: number;
    content: string;
    type: string;
    tags: string[];
    confidence: number;
    source: string;
  }>
): ConsolidatedFact[] {
  const consolidated: ConsolidatedFact[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < facts.length; i++) {
    if (used.has(i)) continue;
    
    const current = facts[i];
    const similar: number[] = [i];
    
    // Find similar facts
    for (let j = i + 1; j < facts.length; j++) {
      if (used.has(j)) continue;
      
      const other = facts[j];
      const similarity = calculateTextSimilarity(current.content, other.content);
      
      if (similarity > 0.7) {
        similar.push(j);
        used.add(j);
      }
    }
    
    // Merge similar facts
    if (similar.length === 1) {
      // No duplicates, keep as-is
      consolidated.push({
        content: current.content,
        type: current.type,
        tags: current.tags,
        confidence: current.confidence,
        sources: [current.source],
        mergedFrom: current.id ? [current.id] : [],
        reason: 'No duplicates found',
      });
    } else {
      // Merge into unified fact
      const merged = mergeSimilarFacts(similar.map(idx => facts[idx]));
      merged.mergedFrom = similar.map(idx => facts[idx].id).filter(Boolean) as number[];
      consolidated.push(merged);
    }
    
    used.add(i);
  }
  
  return consolidated;
}

/**
 * Merge similar facts into unified representation
 */
function mergeSimilarFacts(
  facts: Array<{
    content: string;
    type: string;
    tags: string[];
    confidence: number;
    source: string;
  }>
): ConsolidatedFact {
  // Use the most confident fact as base
  facts.sort((a, b) => b.confidence - a.confidence);
  const base = facts[0];
  
  // Combine tags
  const allTags = new Set<string>();
  for (const fact of facts) {
    for (const tag of fact.tags) {
      allTags.add(tag);
    }
  }
  
  // Average confidence
  const avgConfidence = facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length;
  
  // Combine sources
  const allSources = [...new Set(facts.map(f => f.source))];
  
  // Create merged content (use base, but note consolidation)
  const mergedContent = facts.length > 1
    ? `${base.content} [Consolidated from ${facts.length} similar facts]`
    : base.content;
  
  return {
    content: mergedContent,
    type: base.type,
    tags: [...allTags],
    confidence: avgConfidence,
    sources: allSources,
    mergedFrom: [],
    reason: `Consolidated ${facts.length} similar facts`,
  };
}

/**
 * Calculate text similarity (simple cosine on word vectors)
 */
function calculateTextSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  
  const allWords = [...new Set([...wordsA, ...wordsB])];
  
  const vecA = allWords.map(w => wordsA.filter(x => x === w).length);
  const vecB = allWords.map(w => wordsB.filter(x => x === w).length);
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < allWords.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage 3: Active Learning
// ──────────────────────────────────────────────────────────────────────────────

export interface ClarifyingQuestion {
  question: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generate clarifying questions when learning is uncertain
 */
export function generateClarifyingQuestions(
  content: string,
  validationResult: ValidationResult
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = [];
  
  // Low confidence
  if (validationResult.confidence < 0.6) {
    questions.push({
      question: "Can you provide more context or examples for this?",
      reason: "Low confidence in extracted knowledge",
      priority: 'high',
    });
  }
  
  // Contradictions detected
  if (validationResult.issues.some(i => i.includes('Contradicts'))) {
    questions.push({
      question: "This seems to contradict what I learned earlier. Which is correct?",
      reason: "Contradiction with existing knowledge",
      priority: 'high',
    });
  }
  
  // Vague or incomplete
  if (content.length < 30) {
    questions.push({
      question: "Can you elaborate on this? What specifically should I remember?",
      reason: "Statement too brief for reliable learning",
      priority: 'medium',
    });
  }
  
  // Opinion without context
  if (/\b(think|believe|feel|opinion)\b/i.test(content) && !/\b(because|since|reason)\b/i.test(content)) {
    questions.push({
      question: "What leads you to this conclusion? Any specific reasons?",
      reason: "Opinion without supporting reasoning",
      priority: 'medium',
    });
  }
  
  return questions;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage 4: Learning Analytics
// ──────────────────────────────────────────────────────────────────────────────

export interface LearningMetrics {
  factsLearned: number;
  factsRejected: number;
  averageQuality: number;
  contradictionsDetected: number;
  duplicatesConsolidated: number;
  clarifyingQuestionsAsked: number;
  topTopics: string[];
}

/**
 * Track learning metrics for continuous improvement
 */
export function trackLearningMetrics(
  facts: Array<{ content: string; type: string; tags: string[]; validated: boolean }>,
  validationResults: ValidationResult[],
  consolidated: ConsolidatedFact[]
): LearningMetrics {
  const learned = facts.filter(f => f.validated);
  const rejected = facts.filter(f => !f.validated);
  
  const avgQuality = validationResults.reduce((sum, r) => sum + r.quality, 0) / validationResults.length;
  
  const contradictions = validationResults.filter(r => 
    r.issues.some(i => i.includes('Contradicts'))
  ).length;
  
  const duplicates = consolidated.filter(c => c.mergedFrom.length > 1).length;
  
  // Extract top topics
  const topicCounts: Record<string, number> = {};
  for (const fact of learned) {
    for (const tag of fact.tags) {
      topicCounts[tag] = (topicCounts[tag] || 0) + 1;
    }
  }
  
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);
  
  return {
    factsLearned: learned.length,
    factsRejected: rejected.length,
    averageQuality: avgQuality,
    contradictionsDetected: contradictions,
    duplicatesConsolidated: duplicates,
    clarifyingQuestionsAsked: validationResults.filter(r => r.confidence < 0.6).length,
    topTopics,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Learning Pipeline
// ──────────────────────────────────────────────────────────────────────────────

export interface LearningResult {
  factsToStore: ConsolidatedFact[];
  validationResults: ValidationResult[];
  clarifyingQuestions: ClarifyingQuestion[];
  metrics: LearningMetrics;
  shouldAskUser: boolean;
}

/**
 * Complete learning pipeline
 * 1. Validate facts
 * 2. Consolidate duplicates
 * 3. Generate clarifying questions if needed
 * 4. Track metrics
 */
export async function processLearningPipeline(
  rawFacts: Array<{
    content: string;
    type: string;
    tags: string[];
    confidence: number;
    source: string;
  }>,
  context: LearningContext
): Promise<LearningResult> {
  logger.info(
    { factCount: rawFacts.length, source: context.source },
    'Starting learning pipeline'
  );
  
  // Stage 1: Validate each fact
  const validationResults: ValidationResult[] = [];
  const validatedFacts = [];
  
  for (const fact of rawFacts) {
    const validation = await validateFactForLearning(fact.content, fact.type, context);
    validationResults.push(validation);
    
    if (validation.isValid) {
      validatedFacts.push({
        ...fact,
        validated: true,
      });
    }
  }
  
  // Stage 2: Consolidate duplicates
  const consolidated = consolidateFacts(validatedFacts);
  
  // Stage 3: Generate clarifying questions
  const clarifyingQuestions: ClarifyingQuestion[] = [];
  for (let i = 0; i < rawFacts.length; i++) {
    const questions = generateClarifyingQuestions(rawFacts[i].content, validationResults[i]);
    clarifyingQuestions.push(...questions);
  }
  
  // Stage 4: Track metrics
  const metrics = trackLearningMetrics(
    validatedFacts,
    validationResults,
    consolidated
  );
  
  // Determine if we should ask user for clarification
  const shouldAskUser = clarifyingQuestions.some(q => q.priority === 'high');
  
  return {
    factsToStore: consolidated,
    validationResults,
    clarifyingQuestions,
    metrics,
    shouldAskUser,
  };
}
