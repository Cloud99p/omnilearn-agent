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
