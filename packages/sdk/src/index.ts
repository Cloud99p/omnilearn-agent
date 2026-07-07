/**
 * OmniLearn SDK
 * 
 * Universal knowledge layer for AI + blockchain systems.
 * Connect any service to OmniLearn's distributed intelligence network.
 * 
 * @packageDocumentation
 */

// Core client
export { OmniLearnClient } from './client';

// Type definitions
export type {
  // Configuration
  OmniLearnClientConfig,
  
  // Knowledge Recording
  RecordParams,
  RecordMetadata,
  RecordResponse,
  BatchRecordParams,
  BatchRecordResponse,
  
  // Knowledge Search
  SearchParams,
  TimeRange,
  KnowledgeNode,
  SearchResponse,
  
  // Real-time Streaming
  StreamParams,
  StreamEvent,
  KnowledgeEdge,
  HeartbeatData,
  
  // Service Management
  ServiceStats,
  ServiceInfo,
  
  // Health Check
  HealthStatus,
  
  // Schema Management
  KnowledgeSchema,
  RegisterSchemaParams,
  RegisterSchemaResponse,
  
  // Service Registration
  RegisterServiceParams,
  RegisterServiceResponse,
  
  // Error Handling
  ErrorResponse,
} from './types';

// Error classes
export { OmniLearnError } from './types';

/**
 * SDK Version
 */
export const VERSION = '1.0.0';

/**
 * Create a new OmniLearn client instance
 * 
 * @example
 * ```typescript
 * import { createClient } from '@omnilearn/sdk';
 * 
 * const client = createClient({
 *   apiKey: 'omni_sk_xxx',
 *   apiBaseUrl: 'https://api.omnilearn.ai',
 *   serviceName: 'my-service',
 * });
 * ```
 */
export function createClient(config: import('./types').OmniLearnClientConfig) {
  return new OmniLearnClient(config);
}

/**
 * Default export for convenience
 * 
 * @example
 * ```typescript
 * import OmniLearn from '@omnilearn/sdk';
 * 
 * const client = new OmniLearn({
 *   apiKey: 'omni_sk_xxx',
 *   apiBaseUrl: 'https://api.omnilearn.ai',
 *   serviceName: 'my-service',
 * });
 * ```
 */
export default OmniLearnClient;
