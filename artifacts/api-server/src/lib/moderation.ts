import { logger } from "./logger.js";

// ──────────────────────────────────────────────────────────────────────────────
// Content Moderation System
// Prevents harmful, illegal, or dangerous content from being learned
// ──────────────────────────────────────────────────────────────────────────────

export interface ModerationResult {
  approved: boolean;
  reason?: string;
  category?: string;
  severity?: "low" | "medium" | "high" | "critical";
  flaggedPatterns?: string[];
}

// ─── Harmful Content Patterns ────────────────────────────────────────────────

const HARMFUL_PATTERNS = {
  // Violence and harm
  violence: [
    /kill (yourself|myself|yourself|them|him|her)/i,
    /commit suicide/i,
    /hurt (yourself|someone|somebody)/i,
    /build (a|an)? (bomb|weapon|explosive)/i,
    /make (a|an)? (bomb|weapon|explosive)/i,
    /how to (kill|murder|assassinate)/i,
    /instructions to (kill|murder|assassinate)/i,
    /poison (someone|somebody|them)/i,
    /harm (children|kids|minors)/i,
    /child (abuse|exploitation|molestation)/i,
  ],

  // Hate speech and discrimination
  hate: [
    /\b(nigger|nigga|faggot|fag|dyke|tranny|chink|gook|spic)\b/i,
    /(white|black|asian|hispanic) (supremacy|power)/i,
    /(kill|death to) (jews|muslims|christians|blacks|whites)/i,
    /race (war|mixture|mixing) is/i,
    /(gay|lesbian|trans) (people|persons) (should|must) (die|be killed)/i,
    /holocaust (denial|hoax)/i,
  ],

  // Self-harm and mental health
  selfHarm: [
    /cut(ting)? (yourself|myself)/i,
    /anorexia (tips|advice|how to)/i,
    /bulimia (tips|advice|how to)/i,
    /eating disorder (tips|how to)/i,
    /suicide (method|ways|how to)/i,
    /overdose (on|pills)/i,
  ],

  // Illegal activities
  illegal: [
    /buy (guns?|weapons?|drugs?|cocaine|heroin|meth)/i,
    /sell (drugs?|cocaine|heroin|meth|weapons?)/i,
    /make (meth|cocaine|heroin)/i,
    /launder (money|cash)/i,
    /tax evasion (tips|how to)/i,
    /hack (into|accounts?|banks?)/i,
    /steal (credit cards?|identity|data)/i,
    /phishing (guide|tutorial|how to)/i,
    /child porn/i,
    /csam/i,
  ],

  // Dangerous instructions
  dangerous: [
    /bypass (security|authentication|2fa|mfa)/i,
    /create (malware|virus|trojan|ransomware)/i,
    /ddos (attack|tutorial|how to)/i,
    /exploit (vulnerability|cve)/i,
    /sql injection (tutorial|guide|how to)/i,
    /make (meth|pcp|lsd|mdma)/i,
    /build (still|meth lab)/i,
  ],

  // Sexual content involving minors
  sexualMinors: [
    /teen (sex|porn|nude)/i,
    /underage (sex|porn|nude)/i,
    /child (sex|porn|nude)/i,
    /lolita/i,
    /shota/i,
  ],

  // Harassment and doxxing
  harassment: [
    /dox (someone|somebody|them|him|her)/i,
    /find (someone|somebody)'s (address|phone|email)/i,
    /stalk (someone|somebody|them)/i,
    /harass (someone|somebody|them)/i,
    /threaten (someone|somebody|them)/i,
  ],
};

// ─── PII Detection ───────────────────────────────────────────────────────────

const PII_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
  phone: /(\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  passport: /\b[A-Z]{1,2}\d{6,9}\b/,
  driversLicense: /\b[A-Z]\d{7,8}\b/,
  bankAccount: /\b\d{8,17}\b/,
  medicalRecord: /\bMRN[- ]?\d{6,10}\b/i,
};

// ─── Moderation Functions ────────────────────────────────────────────────────

export function moderateContent(content: string): ModerationResult {
  const results: Array<{ category: string; severity: string; patterns: string[] }> = [];

  // Check harmful content categories
  for (const [category, patterns] of Object.entries(HARMFUL_PATTERNS)) {
    const matches = patterns.filter(pattern => pattern.test(content));
    if (matches.length > 0) {
      const severity = getSeverityForCategory(category);
      results.push({
        category,
        severity,
        patterns: matches.map(m => m.toString()),
      });
    }
  }

  // Check PII
  const piiMatches: string[] = [];
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(content)) {
      piiMatches.push(type);
    }
  }
  if (piiMatches.length > 0) {
    results.push({
      category: "pii",
      severity: "high",
      patterns: piiMatches,
    });
  }

  // Determine overall result
  if (results.length === 0) {
    return { approved: true };
  }

  // Find highest severity
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const highestSeverity = results.reduce((max, r) => 
    severityOrder[r.severity as keyof typeof severityOrder] > severityOrder[max as keyof typeof severityOrder] ? r.severity : max
  , results[0].severity);

  const allPatterns = results.flatMap(r => r.patterns);
  const categories = results.map(r => r.category).join(", ");

  return {
    approved: false,
    reason: `Content blocked: ${categories}`,
    category: categories,
    severity: highestSeverity as "low" | "medium" | "high" | "critical",
    flaggedPatterns: allPatterns,
  };
}

function getSeverityForCategory(category: string): string {
  const critical = ["violence", "hate", "sexualMinors", "selfHarm"];
  const high = ["illegal", "dangerous", "pii", "harassment"];
  
  if (critical.includes(category)) return "critical";
  if (high.includes(category)) return "high";
  return "medium";
}

// ─── Batch Moderation (for network contributions) ───────────────────────────

export function moderateBatch(items: Array<{ content: string; type?: string }>): {
  approved: Array<{ content: string; type?: string }>;
  rejected: Array<{ content: string; type?: string; reason: string }>;
} {
  const approved: Array<{ content: string; type?: string }> = [];
  const rejected: Array<{ content: string; type?: string; reason: string }> = [];

  for (const item of items) {
    const result = moderateContent(item.content);
    if (result.approved) {
      approved.push(item);
    } else {
      rejected.push({
        ...item,
        reason: result.reason || "Content policy violation",
      });
      logger.warn(
        { category: result.category, severity: result.severity, content: item.content.slice(0, 100) },
        "Content moderation: rejected"
      );
    }
  }

  return { approved, rejected };
}

// ─── User Report Handling ────────────────────────────────────────────────────

export interface UserReport {
  reporterId: string;
  contentType: "knowledge_node" | "network_neuron" | "conversation";
  contentId: number;
  reason: "harmful" | "pii" | "spam" | "harassment" | "other";
  description?: string;
}

export async function submitUserReport(report: UserReport): Promise<{ success: boolean; reportId?: string }> {
  try {
    // Log the report for review
    logger.warn(
      { report },
      "User submitted content report"
    );

    // In production, this would:
    // 1. Insert into a reports table
    // 2. Notify moderators
    // 3. Temporarily flag the content for review
    // 4. Auto-remove if multiple reports received

    const reportId = `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    return { success: true, reportId };
  } catch (error) {
    logger.error({ error }, "Failed to submit user report");
    return { success: false };
  }
}

// ─── Audit Logging ───────────────────────────────────────────────────────────

export interface ModerationAudit {
  timestamp: string;
  userId: string;
  action: "approve" | "reject" | "report" | "review";
  contentType: string;
  contentId?: number;
  reason?: string;
  moderatorId?: string;
}

export function logModerationAudit(audit: ModerationAudit): void {
  logger.info(
    { audit },
    "Moderation audit log"
  );
  // In production, write to a dedicated audit_log table
}

// ─── Export for API routes ───────────────────────────────────────────────────

export default {
  moderateContent,
  moderateBatch,
  submitUserReport,
  logModerationAudit,
  HARMFUL_PATTERNS,
  PII_PATTERNS,
};
