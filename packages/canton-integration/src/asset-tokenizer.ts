/**
 * Asset Tokenizer
 * 
 * Utility for calculating token parameters for RWA issuance.
 * Helps issuers determine optimal token count and face value.
 */

import type { AssetType, IssueParams } from './types';

export interface TokenizationPlan {
  assetType: AssetType;
  totalValue: number;
  currency: string;
  recommendedTokens: number;
  tokenFaceValue: number;
  minInvestment: number;
  targetInvestor: 'retail' | 'institutional' | 'wholesale';
  rationale: string;
}

export class AssetTokenizer {
  /**
   * Calculate optimal tokenization parameters
   */
  static calculatePlan(params: {
    type: AssetType;
    totalValue: number;
    currency?: string;
    targetMarket?: 'retail' | 'institutional';
  }): TokenizationPlan {
    const { type, totalValue, currency = 'USD', targetMarket = 'institutional' } = params;

    let recommendedTokens: number;
    let tokenFaceValue: number;
    let minInvestment: number;
    let targetInvestor: 'retail' | 'institutional' | 'wholesale';
    let rationale: string;

    // Tokenization strategy based on asset type and target market
    if (targetMarket === 'retail') {
      // Retail: Lower token value, higher count
      recommendedTokens = Math.ceil(totalValue / 100); // $100 per token
      tokenFaceValue = totalValue / recommendedTokens;
      minInvestment = 100; // $100 minimum
      targetInvestor = 'retail';
      rationale = 'Retail-friendly tokenization with low minimum investment ($100)';
    } else if (type === 'real-estate' || type === 'structured-product') {
      // High-value assets: Institutional
      recommendedTokens = Math.ceil(totalValue / 100000); // $100K per token
      tokenFaceValue = totalValue / recommendedTokens;
      minInvestment = 100000;
      targetInvestor = 'institutional';
      rationale = 'Institutional tokenization for high-value assets ($100K minimum)';
    } else if (type === 'treasury-bond' || type === 'corporate-bond') {
      // Bonds: Wholesale market standard
      recommendedTokens = Math.ceil(totalValue / 1000); // $1K per token
      tokenFaceValue = totalValue / recommendedTokens;
      minInvestment = 1000;
      targetInvestor = 'wholesale';
      rationale = 'Wholesale bond market standard ($1K minimum, similar to traditional bonds)';
    } else {
      // Default: Institutional
      recommendedTokens = Math.ceil(totalValue / 10000); // $10K per token
      tokenFaceValue = totalValue / recommendedTokens;
      minInvestment = 10000;
      targetInvestor = 'institutional';
      rationale = 'Balanced institutional tokenization ($10K minimum)';
    }

    return {
      assetType: type,
      totalValue,
      currency,
      recommendedTokens,
      tokenFaceValue,
      minInvestment,
      targetInvestor,
      rationale,
    };
  }

  /**
   * Calculate lockup period based on asset type and jurisdiction
   */
  static calculateLockupPeriod(params: {
    type: AssetType;
    jurisdiction: string;
    investorType: 'retail' | 'institutional';
  }): number {
    const { type, jurisdiction, investorType } = params;

    // Base lockup by asset type
    let baseLockup = 0;
    switch (type) {
      case 'treasury-bond':
        baseLockup = 0; // Treasury bonds typically liquid
        break;
      case 'corporate-bond':
        baseLockup = 30; // 30 days
        break;
      case 'equity':
        baseLockup = investorType === 'retail' ? 180 : 90; // Retail: 6mo, Institutional: 3mo
        break;
      case 'real-estate':
        baseLockup = 365; // 1 year (illiquid asset)
        break;
      case 'commodity':
        baseLockup = 7; // 1 week
        break;
      case 'fund-share':
        baseLockup = 90; // 3 months
        break;
      case 'structured-product':
        baseLockup = 180; // 6 months
        break;
    }

    // Jurisdiction adjustments
    if (jurisdiction === 'US') {
      baseLockup += 90; // SEC Regulation D adds 90 days
    } else if (jurisdiction === 'EU') {
      baseLockup += 30; // MiFID II adds 30 days
    }

    return baseLockup;
  }

  /**
   * Validate asset parameters
   */
  static validateParams(params: IssueParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.name || params.name.trim().length === 0) {
      errors.push('Asset name is required');
    }

    if (!params.type) {
      errors.push('Asset type is required');
    }

    if (params.totalValue <= 0) {
      errors.push('Total value must be positive');
    }

    if (params.totalValue < 1000) {
      errors.push('Minimum total value is $1,000');
    }

    if (params.tokensCount && params.tokensCount < 1) {
      errors.push('Token count must be at least 1');
    }

    if (params.maturityDate && params.maturityDate <= new Date()) {
      errors.push('Maturity date must be in the future');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
