/**
 * Canton Network Integration Types
 */

export interface CantonConfig {
  /** Canton Network RPC endpoint */
  rpcUrl: string;
  /** API key for authenticated access */
  apiKey?: string;
  /** DAML ledger URL */
  ledgerUrl?: string;
  /** Privacy domain ID */
  domainId?: string;
}

export type AssetType = 
  | 'treasury-bond'
  | 'corporate-bond'
  | 'equity'
  | 'real-estate'
  | 'commodity'
  | 'fund-share'
  | 'structured-product';

export interface RWAAsset {
  /** Unique asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Asset type */
  type: AssetType;
  /** Total tokenized value */
  totalValue: number;
  /** Currency (USD, EUR, etc.) */
  currency: string;
  /** Number of tokens minted */
  tokensMinted: number;
  /** Token face value */
  tokenValue: number;
  /** Issuer DID */
  issuer: string;
  /** Issue date */
  issueDate: Date;
  /** Maturity date (if applicable) */
  maturityDate?: Date;
  /** Jurisdiction */
  jurisdiction: string;
  /** Compliance status */
  compliance: ComplianceStatus;
  /** Canton transaction ID */
  txId: string;
  /** Metadata (IPFS hash or similar) */
  metadata?: string;
}

export interface ComplianceStatus {
  /** KYC verified */
  kycVerified: boolean;
  /** AML check passed */
  amlPassed: boolean;
  /** Accredited investor */
  accreditedInvestor: boolean;
  /** Jurisdiction allowed */
  jurisdictionAllowed: boolean;
  /** Lockup period (days) */
  lockupDays: number;
  /** Transfer restrictions */
  restrictions: string[];
}

export interface IssueParams {
  /** Asset name */
  name: string;
  /** Asset type */
  type: AssetType;
  /** Total value to tokenize */
  totalValue: number;
  /** Currency */
  currency?: string;
  /** Number of tokens to mint */
  tokensCount?: number;
  /** Maturity date */
  maturityDate?: Date;
  /** Jurisdiction */
  jurisdiction?: string;
  /** Metadata (optional) */
  metadata?: Record<string, any>;
}

export interface TransferParams {
  /** Asset ID */
  assetId: string;
  /** Number of tokens to transfer */
  tokens: number;
  /** Sender DID */
  from: string;
  /** Receiver DID */
  to: string;
  /** Compliance check required */
  checkCompliance?: boolean;
}

export interface AuditParams {
  /** Asset ID (optional, omit for full audit) */
  assetId?: string;
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Include compliance details */
  includeCompliance?: boolean;
  /** Export format */
  format?: 'json' | 'pdf' | 'csv';
}

export interface Holder {
  /** Holder DID */
  did: string;
  /** Number of tokens held */
  tokens: number;
  /** Acquisition date */
  acquiredAt: Date;
  /** Compliance status */
  compliance: ComplianceStatus;
}

export interface AuditReport {
  /** Report ID */
  id: string;
  /** Generated at */
  generatedAt: Date;
  /** Asset summary */
  assets: RWAAsset[];
  /** Holder distribution */
  holders: Holder[];
  /** Transaction history */
  transactions: Transaction[];
  /** Compliance summary */
  compliance: {
    totalHolders: number;
    kycVerified: number;
    amlPassed: number;
    violations: string[];
  };
}

export interface Transaction {
  /** Transaction ID */
  id: string;
  /** Asset ID */
  assetId: string;
  /** Type */
  type: 'issue' | 'transfer' | 'redeem' | 'burn';
  /** From */
  from?: string;
  /** To */
  to?: string;
  /** Tokens */
  tokens: number;
  /** Timestamp */
  timestamp: Date;
  /** Canton tx hash */
  txHash: string;
  /** Status */
  status: 'pending' | 'confirmed' | 'failed';
}
