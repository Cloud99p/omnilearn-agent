/**
 * Canton Network Integration for OmniLearn
 * 
 * Adds RWA (Real-World Asset) tokenization workflows to OmniLearn
 * without modifying existing core functionality.
 * 
 * @module @omnilearn/canton
 */

export { CantonClient } from './canton-client';
export { RWAWorkflow } from './rwa-workflow';
export { AssetTokenizer } from './asset-tokenizer';

// Types
export type {
  CantonConfig,
  IssueParams,
  TransferParams,
  AuditParams,
  RWAAsset,
  AssetType,
  ComplianceStatus,
} from './types';
