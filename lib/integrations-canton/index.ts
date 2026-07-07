/**
 * Canton Integration Module
 * 
 * This module provides Canton Network integration for OmniLearn.
 * It adds RWA tokenization workflows WITHOUT modifying existing code.
 * 
 * Usage:
 * ```typescript
 * import { CantonClient, RWAWorkflow, AssetTokenizer } from '@omnilearn/canton';
 * 
 * // Initialize
 * const client = new CantonClient({
 *   rpcUrl: process.env.CANTON_RPC_URL,
 *   apiKey: process.env.CANTON_API_KEY,
 * });
 * 
 * await client.connect();
 * 
 * // Issue asset
 * const workflow = new RWAWorkflow(client);
 * const result = await workflow.issueAsset({
 *   name: 'Treasury Bond 2026-A',
 *   type: 'treasury-bond',
 *   totalValue: 1000000,
 *   tokensCount: 1000,
 * });
 * ```
 */

export { CantonClient } from './packages/canton-integration/src/canton-client';
export { RWAWorkflow } from './packages/canton-integration/src/rwa-workflow';
export { AssetTokenizer } from './packages/canton-integration/src/asset-tokenizer';

export type {
  CantonConfig,
  RWAAsset,
  IssueParams,
  TransferParams,
  AuditParams,
  ComplianceStatus,
  AssetType,
} from './packages/canton-integration/src/types';
