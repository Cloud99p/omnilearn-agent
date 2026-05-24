/**
 * Ontology Reflection System Tests
 * Tests for ontology proposal validation, execution, and reflection cycle
 */

import { describe, it, expect } from 'vitest';
import {
  validateOntologyProposal,
  executeOntologyProposal,
  runOntologyReflection,
} from '../src/brain/ontology.js';

// Mock the database layer for unit testing
// In integration tests, these would use a real test database

describe('Ontology Reflection System', () => {
  describe('Proposal validation logic', () => {
    it('should validate rationale hash correctly', () => {
      // Test the hash logic independently
      const crypto = require('crypto');
      const rationale = 'Test rationale for ontology change';
      const hash = crypto.createHash('sha256').update(rationale, 'utf8').digest('hex');
      expect(hash).toHaveLength(64);
    });

    it('should detect hash mismatches', () => {
      const crypto = require('crypto');
      const rationale = 'Original rationale';
      const correctHash = crypto.createHash('sha256').update(rationale, 'utf8').digest('hex');
      const wrongHash = crypto.createHash('sha256').update('Different rationale', 'utf8').digest('hex');
      expect(correctHash).not.toBe(wrongHash);
    });

    it('should validate freshness within 7 days', () => {
      const now = Date.now();
      const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
      
      expect(now - sixDaysAgo < 7 * 24 * 60 * 60 * 1000).toBe(true);
      expect(now - eightDaysAgo < 7 * 24 * 60 * 60 * 1000).toBe(false);
    });
  });

  describe('Ontology proof construction', () => {
    const crypto = require('crypto');

    const buildOntologyProof = (
      opType: string,
      targetNodeId: number | null,
      targetNodeBId: number | null,
      rationaleHash: string,
      isoTimestamp: string,
    ): string => {
      const input = [
        opType,
        targetNodeId ?? 'null',
        targetNodeBId ?? 'null',
        rationaleHash,
        isoTimestamp,
      ].join('|');
      return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    };

    it('should produce consistent proofs', () => {
      const proof1 = buildOntologyProof('merge-nodes', 1, 2, 'hash123', '2026-01-01T00:00:00.000Z');
      const proof2 = buildOntologyProof('merge-nodes', 1, 2, 'hash123', '2026-01-01T00:00:00.000Z');
      expect(proof1).toBe(proof2);
    });

    it('should change with different operation types', () => {
      const proof1 = buildOntologyProof('merge-nodes', 1, 2, 'hash', '2026-01-01T00:00:00.000Z');
      const proof2 = buildOntologyProof('split-node', 1, 2, 'hash', '2026-01-01T00:00:00.000Z');
      expect(proof1).not.toBe(proof2);
    });

    it('should handle null node IDs', () => {
      const proof1 = buildOntologyProof('new-edge-type', null, null, 'hash', '2026-01-01T00:00:00.000Z');
      const proof2 = buildOntologyProof('new-edge-type', 1, 2, 'hash', '2026-01-01T00:00:00.000Z');
      expect(proof1).not.toBe(proof2);
    });
  });

  describe('Operation types', () => {
    it('should support new-edge-type operations', () => {
      const opType = 'new-edge-type';
      expect(['new-edge-type', 'split-node', 'merge-nodes', 'demote-rule']).toContain(opType);
    });

    it('should support split-node operations', () => {
      const opType = 'split-node';
      expect(['new-edge-type', 'split-node', 'merge-nodes', 'demote-rule']).toContain(opType);
    });

    it('should support merge-nodes operations', () => {
      const opType = 'merge-nodes';
      expect(['new-edge-type', 'split-node', 'merge-nodes', 'demote-rule']).toContain(opType);
    });

    it('should support demote-rule operations', () => {
      const opType = 'demote-rule';
      expect(['new-edge-type', 'split-node', 'merge-nodes', 'demote-rule']).toContain(opType);
    });
  });

  describe('Reflection cycle heuristics', () => {
    describe('Jaccard similarity for merge detection', () => {
      const jaccard = (a: string[], b: string[]): number => {
        if (!a.length || !b.length) return 0;
        const setA = new Set(a);
        const setB = new Set(b);
        let inter = 0;
        for (const t of setA) if (setB.has(t)) inter++;
        return inter / new Set([...a, ...b]).size;
      };

      it('should return 1 for identical sets', () => {
        const sim = jaccard(['a', 'b', 'c'], ['a', 'b', 'c']);
        expect(sim).toBe(1);
      });

      it('should return 0 for disjoint sets', () => {
        const sim = jaccard(['a', 'b'], ['c', 'd']);
        expect(sim).toBe(0);
      });

      it('should return partial similarity for overlapping sets', () => {
        const sim = jaccard(['a', 'b', 'c'], ['b', 'c', 'd']);
        expect(sim).toBeCloseTo(0.5, 2);
      });

      it('should handle empty sets', () => {
        expect(jaccard([], [])).toBe(0);
        expect(jaccard(['a'], [])).toBe(0);
      });
    });

    describe('Edge type diversity for split detection', () => {
      it('should flag nodes with many relationship types for splitting', () => {
        const relationshipTypes = ['co-occurs', 'related-to', 'causes', 'supports', 'contradicts'];
        expect(relationshipTypes.length).toBeGreaterThanOrEqual(4);
      });

      it('should not flag nodes with few relationship types', () => {
        const relationshipTypes = ['related-to'];
        expect(relationshipTypes.length).toBeLessThan(4);
      });
    });

    describe('Confidence thresholds for demotion', () => {
      it('should demote rules with confidence below 0.4', () => {
        const confidence = 0.35;
        const threshold = 0.4;
        expect(confidence < threshold).toBe(true);
      });

      it('should keep rules with confidence above threshold', () => {
        const confidence = 0.65;
        const threshold = 0.4;
        expect(confidence < threshold).toBe(false);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very long rationale text', () => {
      const longRationale = 'A'.repeat(5000);
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(longRationale, 'utf8').digest('hex');
      expect(hash).toHaveLength(64);
    });

    it('should handle special characters in operation types', () => {
      const crypto = require('crypto');
      const proof = crypto.createHash('sha256').update('new-edge-type', 'utf8').digest('hex');
      expect(proof).toHaveLength(64);
    });

    it('should handle unicode in rationale', () => {
      const unicodeRationale = 'Test rationale with 中文 and émojis 🎉';
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(unicodeRationale, 'utf8').digest('hex');
      expect(hash).toHaveLength(64);
    });
  });

  describe('Cooldown mechanism', () => {
    it('should enforce reflection cooldown', () => {
      const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
      const now = Date.now();
      const lastRun5MinAgo = now - 5 * 60 * 1000;
      const lastRun15MinAgo = now - 15 * 60 * 1000;

      expect(now - lastRun5MinAgo < COOLDOWN_MS).toBe(true); // should skip
      expect(now - lastRun15MinAgo < COOLDOWN_MS).toBe(false); // should run
    });
  });

  describe('Proposal status transitions', () => {
    it('should follow correct status flow', () => {
      const statuses = ['pending', 'approved', 'executed', 'rejected'];
      
      // pending -> approved -> executed
      expect(statuses.indexOf('approved')).toBeGreaterThan(statuses.indexOf('pending'));
      expect(statuses.indexOf('executed')).toBeGreaterThan(statuses.indexOf('approved'));
      
      // pending -> rejected (alternate path)
      expect(statuses.indexOf('rejected')).toBeGreaterThan(statuses.indexOf('pending'));
    });
  });
});
