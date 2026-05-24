/**
 * Integration Tests
 * Tests for interactions between character, hebbian, ontology, and network systems
 * 
 * Note: Tests only cover pure functions that don't require database access.
 * Full integration tests with database should be run separately.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock database dependencies
vi.mock('@workspace/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  hebbianProposals: {},
  knowledgeNodes: {},
  knowledgeEdges: {},
  networkNeurons: {},
  networkSynapses: {},
  networkAgents: {},
}));

vi.mock('../src/lib/moderation.js', () => ({
  moderateBatch: vi.fn(),
  logModerationAudit: vi.fn(),
}));

vi.mock('../src/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  clamp,
  applyDeltas,
  computeTraitDeltaFromLearning,
  rebalanceTraits,
  needsRebalancing,
} from '../src/brain/character.js';
import { buildEvidenceHash, buildProposalProof } from '../src/brain/hebbian.js';

describe('System Integration', () => {
  describe('Character-Hebbian Interaction', () => {
    it('should balance trait evolution from learning', () => {
      // Simulate learning session with mixed content
      const baseState = {
        curiosity: 50,
        caution: 50,
        confidence: 50,
        verbosity: 50,
        technical: 50,
        empathy: 50,
        creativity: 50,
      };

      // Technical learning session
      const techDelta = computeTraitDeltaFromLearning(5, false, true, false);
      const afterTech = applyDeltas(baseState, techDelta);
      
      expect(afterTech.technical).toBeGreaterThan(50);
      expect(afterTech.curiosity).toBeGreaterThan(50);
      expect(afterTech.confidence).toBeGreaterThan(50);
    });

    it('should prevent runaway trait values through soft caps', () => {
      const highCuriosityState = {
        curiosity: 85,
        caution: 50,
        confidence: 50,
        verbosity: 50,
        technical: 50,
        empathy: 50,
        creativity: 50,
      };

      // Multiple learning sessions
      let state = highCuriosityState;
      for (let i = 0; i < 10; i++) {
        const delta = computeTraitDeltaFromLearning(3, false, false, false);
        state = applyDeltas(state, delta);
      }

      // Should not reach 100 due to soft caps
      expect(state.curiosity).toBeLessThan(100);
    });

    it('should rebalance after extreme events', () => {
      const extremeState = {
        curiosity: 95,
        caution: 90,
        confidence: 20,
        verbosity: 50,
        technical: 50,
        empathy: 50,
        creativity: 50,
      };

      expect(needsRebalancing(extremeState)).toBe(true);

      const delta = rebalanceTraits(extremeState, 0.02);
      expect(delta.curiosity).toBeLessThan(0); // should decrease
      expect(delta.caution).toBeLessThan(0); // should decrease
      expect(delta.confidence).toBeGreaterThan(0); // should increase
    });
  });

  describe('Proof System Consistency', () => {
    it('should maintain proof integrity across systems', () => {
      // Hebbian proof
      const hebbianProof = buildProposalProof(
        1, 'causes', 2,
        buildEvidenceHash('evidence'),
        '2026-01-01T00:00:00.000Z'
      );

      // Same inputs should always produce same proof
      const hebbianProof2 = buildProposalProof(
        1, 'causes', 2,
        buildEvidenceHash('evidence'),
        '2026-01-01T00:00:00.000Z'
      );

      expect(hebbianProof).toBe(hebbianProof2);
    });

    it('should detect tampering in proof chains', () => {
      const originalHash = buildEvidenceHash('original evidence');
      const tamperedHash = buildEvidenceHash('tampered evidence');
      
      const originalProof = buildProposalProof(
        1, 'causes', 2, originalHash, '2026-01-01T00:00:00.000Z'
      );
      const tamperedProof = buildProposalProof(
        1, 'causes', 2, tamperedHash, '2026-01-01T00:00:00.000Z'
      );

      expect(originalProof).not.toBe(tamperedProof);
    });
  });

  describe('Multi-system state management', () => {
    it('should handle concurrent trait updates', () => {
      const baseState = {
        curiosity: 50,
        caution: 50,
        confidence: 50,
        verbosity: 50,
        technical: 50,
        empathy: 50,
        creativity: 50,
      };

      // Simulate multiple learning events
      const events = [
        computeTraitDeltaFromLearning(2, false, true, false), // technical
        computeTraitDeltaFromLearning(1, true, false, false), // conflict
        computeTraitDeltaFromLearning(3, false, false, true), // emotional
      ];

      let state = baseState;
      for (const event of events) {
        state = applyDeltas(state, event);
      }

      // Verify all traits remain in valid range
      const traits = Object.values(state);
      for (const trait of traits) {
        expect(trait).toBeGreaterThanOrEqual(0);
        expect(trait).toBeLessThanOrEqual(100);
      }
    });

    it('should maintain consistency after rebalancing', () => {
      const skewedState = {
        curiosity: 90,
        caution: 85,
        confidence: 25,
        verbosity: 80,
        technical: 85,
        empathy: 20,
        creativity: 15,
      };

      // Apply rebalancing until stable
      let state = skewedState;
      let iterations = 0;
      while (needsRebalancing(state) && iterations < 100) {
        const delta = rebalanceTraits(state, 0.02);
        state = applyDeltas(state, delta);
        iterations++;
      }

      // Should converge toward center
      expect(Math.abs(state.curiosity - 50)).toBeLessThan(Math.abs(skewedState.curiosity - 50));
      expect(Math.abs(state.confidence - 50)).toBeLessThan(Math.abs(skewedState.confidence - 50));
    });
  });

  describe('Edge case handling', () => {
    it('should handle zero learning gracefully', () => {
      const delta = computeTraitDeltaFromLearning(0, false, false, false);
      expect(delta.curiosity).toBeUndefined();
      expect(delta.confidence).toBeUndefined();
    });

    it('should handle maximum learning impact', () => {
      const delta = computeTraitDeltaFromLearning(100, true, true, true);
      // Curiosity should be capped
      expect(delta.curiosity).toBeLessThanOrEqual(15); // 100 * 0.15 cap
      // Caution from conflict
      expect(delta.caution).toBe(1.5);
    });

    it('should prevent negative trait values', () => {
      const lowState = {
        curiosity: 5,
        caution: 5,
        confidence: 5,
        verbosity: 5,
        technical: 5,
        empathy: 5,
        creativity: 5,
      };

      // Large negative delta
      const negativeDelta = { confidence: -10 };
      const result = applyDeltas(lowState, negativeDelta);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('System stability', () => {
    it('should maintain equilibrium with balanced input', () => {
      const centeredState = {
        curiosity: 50,
        caution: 50,
        confidence: 50,
        verbosity: 50,
        technical: 50,
        empathy: 50,
        creativity: 50,
      };

      // Balanced learning (technical + emotional)
      const balancedDelta = {
        ...computeTraitDeltaFromLearning(2, false, true, false),
        ...computeTraitDeltaFromLearning(2, false, false, true),
      };

      const result = applyDeltas(centeredState, balancedDelta);
      
      // Should remain relatively centered
      expect(Math.abs(result.curiosity - 50)).toBeLessThan(10);
      expect(Math.abs(result.confidence - 50)).toBeLessThan(10);
    });

    it('should recover from extreme states', () => {
      const extremeState = {
        curiosity: 100,
        caution: 100,
        confidence: 0,
        verbosity: 100,
        technical: 100,
        empathy: 0,
        creativity: 0,
      };

      // Rebalancing should move toward center
      const delta = rebalanceTraits(extremeState, 0.05);
      expect(delta.curiosity).toBeLessThan(0);
      expect(delta.confidence).toBeGreaterThan(0);
    });
  });
});
