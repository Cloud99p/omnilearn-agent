/**
 * AI Feature Configuration
 * 
 * Centralized configuration for all AI-powered features.
 * All features are reversible via environment variables.
 * 
 * Usage:
 *   import { aiConfig } from './ai-config.js';
 *   
 *   if (aiConfig.extraction.enabled) {
 *     // Use AI extraction
 *   } else {
 *     // Use regex extraction
 *   }
 */

export interface AIFeatureConfig {
  enabled: boolean;
  model: string;
  fallback: 'regex' | 'rule-based' | 'none';
  logUsage: boolean;
}

export interface AIConfig {
  // Master switch (disables ALL AI features)
  enabled: boolean;
  
  // Individual features
  extraction: AIFeatureConfig;
  queryUnderstanding: AIFeatureConfig;
  contradictionDetection: AIFeatureConfig;
  knowledgeConsolidation: AIFeatureConfig;
  retrievalReranking: AIFeatureConfig;
  sessionMemory: AIFeatureConfig;
  ontologyReflection: AIFeatureConfig;
  characterResponse: AIFeatureConfig;
  documentSummarization: AIFeatureConfig;
  
  // Global settings
  provider: 'freellm' | 'anthropic' | 'openai';
  freeLLMBaseURL: string;
  freeLLMModel: string;
  logAllUsage: boolean;
  gradualRolloutPercent: number; // 0-100, for gradual rollout
}

/**
 * Load AI configuration from environment variables
 */
export function loadAIConfig(): AIConfig {
  const masterEnabled = process.env.AI_ENABLED !== 'false'; // Default: true
  const gradualRollout = parseInt(process.env.AI_GRADUAL_ROLLOUT_PERCENT || '100', 10);
  
  return {
    enabled: masterEnabled,
    
    extraction: {
      enabled: process.env.AI_EXTRACTION_ENABLED !== 'false' && masterEnabled,
      model: process.env.AI_EXTRACTION_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'regex',
      logUsage: process.env.AI_LOG_EXTRACTION === 'true',
    },
    
    queryUnderstanding: {
      enabled: process.env.AI_QUERY_UNDERSTANDING_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_QUERY_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'rule-based',
      logUsage: process.env.AI_LOG_QUERY === 'true',
    },
    
    contradictionDetection: {
      enabled: process.env.AI_CONTRADICTION_DETECTION_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_CONTRADICTION_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'rule-based',
      logUsage: process.env.AI_LOG_CONTRADICTION === 'true',
    },
    
    knowledgeConsolidation: {
      enabled: process.env.AI_KNOWLEDGE_CONSOLIDATION_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_CONSOLIDATION_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'rule-based',
      logUsage: process.env.AI_LOG_CONSOLIDATION === 'true',
    },
    
    retrievalReranking: {
      enabled: process.env.AI_RETRIEVAL_RERANKING_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_RERANK_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'rule-based',
      logUsage: process.env.AI_LOG_RERANK === 'true',
    },
    
    sessionMemory: {
      enabled: process.env.AI_SESSION_MEMORY_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_SESSION_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'none',
      logUsage: process.env.AI_LOG_SESSION === 'true',
    },
    
    ontologyReflection: {
      enabled: process.env.AI_ONTOLOGY_REFLECTION_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_ONTOLOGY_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'rule-based',
      logUsage: process.env.AI_LOG_ONTOLOGY === 'true',
    },
    
    characterResponse: {
      enabled: process.env.AI_CHARACTER_RESPONSE_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_CHARACTER_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'rule-based',
      logUsage: process.env.AI_LOG_CHARACTER === 'true',
    },
    
    documentSummarization: {
      enabled: process.env.AI_DOCUMENT_SUMMARIZATION_ENABLED === 'true' && masterEnabled,
      model: process.env.AI_SUMMARY_MODEL || process.env.FREELLM_MODEL || 'gpt-4o',
      fallback: 'none',
      logUsage: process.env.AI_LOG_SUMMARY === 'true',
    },
    
    provider: (process.env.AI_PROVIDER as any) || 'freellm',
    freeLLMBaseURL: process.env.FREELLM_BASE_URL || 'https://freellm.com/api/v1',
    freeLLMModel: process.env.FREELLM_MODEL || 'gpt-4o',
    logAllUsage: process.env.AI_LOG_ALL === 'true',
    gradualRolloutPercent: gradualRollout,
  };
}

/**
 * Check if a feature should be enabled (respects gradual rollout)
 */
export function shouldEnableFeature(config: AIFeatureConfig, featureName: string): boolean {
  if (!config.enabled) {
    return false;
  }
  
  const globalConfig = loadAIConfig();
  
  // Check gradual rollout
  if (globalConfig.gradualRolloutPercent < 100) {
    // Use consistent hashing based on feature name + timestamp
    // This ensures the same feature is enabled/disabled consistently
    const hash = simpleHash(featureName + new Date().toDateString());
    const bucket = hash % 100;
    
    if (bucket >= globalConfig.gradualRolloutPercent) {
      return false;
    }
  }
  
  return true;
}

/**
 * Simple hash function for gradual rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Log AI feature usage (if enabled)
 */
export function logAIUsage(
  feature: string,
  data: {
    enabled: boolean;
    method: 'ai' | 'fallback';
    latency?: number;
    tokens?: number;
    result?: any;
    error?: string;
  }
) {
  const config = loadAIConfig();
  
  if (!config.logAllUsage && !config[feature as keyof typeof config]?.logUsage) {
    return;
  }
  
  const logger = (global as any).logger || console;
  
  if (data.error) {
    logger.error(
      { feature, ...data },
      `AI feature ${feature} failed`
    );
  } else if (config.logAllUsage || data.method === 'ai') {
    logger.info(
      { feature, ...data },
      `AI feature ${feature} used`
    );
  }
}

/**
 * Get AI provider configuration for Vercel AI SDK
 */
export function getAIProvider(model?: string) {
  const config = loadAIConfig();
  
  if (config.provider === 'freellm') {
    const { createOpenAI } = require('@ai-sdk/openai');
    return createOpenAI({
      baseURL: config.freeLLMBaseURL,
      apiKey: process.env.FREELLM_API_KEY || 'not-needed',
    })(model || config.freeLLMModel);
  }
  
  if (config.provider === 'anthropic') {
    const { createAnthropic } = require('@ai-sdk/anthropic');
    return createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })(model || 'claude-sonnet-4-20250514');
  }
  
  // Default to OpenAI
  const { createOpenAI } = require('@ai-sdk/openai');
  return createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })(model || 'gpt-4o');
}

// Export singleton config
export const aiConfig = loadAIConfig();

// Hot-reload config on env changes (for development)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    // Config will be reloaded on next import
  }, 5000);
}
