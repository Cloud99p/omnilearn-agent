/**
 * Character Trait System Tests
 * Tests for personality trait evolution, soft caps, and rebalancing
 */

import { describe, it, expect } from 'vitest';
import {
  clamp,
  applySoftCap,
  applyDeltas,
  computeTraitDeltaFromLearning,
  rebalanceTraits,
  needsRebalancing,
  getVoiceModifiers,
  detectTechnicalContent,
  detectEmotionalContent,
  type TraitDelta,
} from '../src/brain/character.js';

describe('Character Trait System', () => {
  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('should use default range 0-100', () => {
      expect(clamp(-5)).toBe(0);
      expect(clamp(105)).toBe(100);
    });
  });

  describe('applySoftCap', () => {
    it('should apply full delta below threshold', () => {
      expect(applySoftCap(50, 5, 70, 0.25)).toBe(5);
      expect(applySoftCap(69, 10, 70, 0.25)).toBe(10);
    });

    it('should reduce delta above threshold', () => {
      expect(applySoftCap(75, 10, 70, 0.25)).toBe(2.5); // 10 * 0.25
      expect(applySoftCap(80, 8, 70, 0.25)).toBe(2); // 8 * 0.25
    });

    it('should apply stricter cap after 90', () => {
      expect(applySoftCap(95, 10, 70, 0.25)).toBe(1); // 10 * 0.1
      expect(applySoftCap(92, 20, 70, 0.25)).toBe(2); // 20 * 0.1
    });

    it('should handle negative deltas correctly', () => {
      expect(applySoftCap(80, -5, 70, 0.25)).toBe(-1.25); // -5 * 0.25
    });
  });

  describe('applyDeltas', () => {
    const baseState = {
      curiosity: 50,
      caution: 50,
      confidence: 50,
      verbosity: 50,
      technical: 50,
      empathy: 50,
      creativity: 50,
    };

    it('should apply deltas to all traits', () => {
      const delta: TraitDelta = {
        curiosity: 5,
        confidence: 3,
        technical: 2,
      };
      const result = applyDeltas(baseState, delta);
      expect(result.curiosity).toBe(55);
      expect(result.confidence).toBe(53);
      expect(result.technical).toBe(52);
      expect(result.caution).toBe(50); // unchanged
    });

    it('should clamp values to 0-100', () => {
      const delta: TraitDelta = { curiosity: 60 };
      const result = applyDeltas(baseState, delta);
      expect(result.curiosity).toBe(100); // clamped from 110
    });

    it('should apply soft cap for high values', () => {
      const highState = { ...baseState, curiosity: 85 };
      const delta: TraitDelta = { curiosity: 10 };
      const result = applyDeltas(highState, delta);
      expect(result.curiosity).toBeLessThan(95); // soft cap applied
    });
  });

  describe('computeTraitDeltaFromLearning', () => {
    it('should increase curiosity and confidence for new learning', () => {
      const delta = computeTraitDeltaFromLearning(3, false, false, false);
      expect(delta.curiosity).toBeGreaterThan(0);
      expect(delta.confidence).toBeGreaterThan(0);
    });

    it('should increase caution and decrease confidence on conflict', () => {
      const delta = computeTraitDeltaFromLearning(0, true, false, false);
      expect(delta.caution).toBe(1.5);
      expect(delta.confidence).toBe(-0.8);
    });

    it('should increase technical trait for technical content', () => {
      const delta = computeTraitDeltaFromLearning(1, false, true, false);
      expect(delta.technical).toBe(0.6);
    });

    it('should increase empathy and creativity for emotional content', () => {
      const delta = computeTraitDeltaFromLearning(1, false, false, true);
      expect(delta.empathy).toBe(0.7);
      expect(delta.creativity).toBe(0.3);
    });

    it('should combine multiple factors', () => {
      const delta = computeTraitDeltaFromLearning(2, true, true, true);
      expect(delta.curiosity).toBeGreaterThan(0);
      expect(delta.caution).toBe(1.5);
      expect(delta.technical).toBe(0.6);
      expect(delta.empathy).toBe(0.7);
    });
  });

  describe('rebalanceTraits', () => {
    const centeredState = {
      curiosity: 50,
      caution: 50,
      confidence: 50,
      verbosity: 50,
      technical: 50,
      empathy: 50,
      creativity: 50,
    };

    it('should not rebalance centered traits', () => {
      const delta = rebalanceTraits(centeredState);
      expect(delta.curiosity).toBeUndefined();
      expect(delta.caution).toBeUndefined();
    });

    it('should rebalance traits far from center', () => {
      const skewedState = {
        ...centeredState,
        curiosity: 90,
        caution: 20,
      };
      const delta = rebalanceTraits(skewedState, 0.02);
      expect(delta.curiosity).toBeLessThan(0); // should decrease
      expect(delta.caution).toBeGreaterThan(0); // should increase
    });

    it('should only rebalance traits beyond threshold', () => {
      const slightlySkewedState = {
        ...centeredState,
        curiosity: 60, // only 10 from center, below 15 threshold
        caution: 80, // 30 from center, above threshold
      };
      const delta = rebalanceTraits(slightlySkewedState, 0.02);
      expect(delta.curiosity).toBeUndefined();
      expect(delta.caution).toBeDefined();
    });
  });

  describe('needsRebalancing', () => {
    const centeredState = {
      curiosity: 50,
      caution: 50,
      confidence: 50,
      verbosity: 50,
      technical: 50,
      empathy: 50,
      creativity: 50,
    };

    it('should return false for centered traits', () => {
      expect(needsRebalancing(centeredState)).toBe(false);
    });

    it('should return true when any trait exceeds threshold', () => {
      const skewedState = { ...centeredState, curiosity: 80 };
      expect(needsRebalancing(skewedState)).toBe(true);
    });

    it('should use custom threshold', () => {
      const slightlySkewedState = { ...centeredState, curiosity: 60 };
      expect(needsRebalancing(slightlySkewedState, 25)).toBe(false);
      expect(needsRebalancing(slightlySkewedState, 5)).toBe(true);
    });
  });

  describe('getVoiceModifiers', () => {
    const baseState = {
      curiosity: 50,
      caution: 50,
      confidence: 50,
      verbosity: 50,
      technical: 50,
      empathy: 50,
      creativity: 50,
    };

    it('should return default phrases for neutral state', () => {
      const modifiers = getVoiceModifiers(baseState);
      expect(modifiers.uncertaintyPhrase).toBe('My understanding suggests');
      expect(typeof modifiers.openingTone).toBe('string');
      expect(typeof modifiers.closingStyle).toBe('string');
      expect(modifiers.prefersDetail).toBe(false);
    });

    it('should prefer detail for high verbosity or technical', () => {
      const highVerbosity = { ...baseState, verbosity: 70 };
      const highTechnical = { ...baseState, technical: 70 };
      expect(getVoiceModifiers(highVerbosity).prefersDetail).toBe(true);
      expect(getVoiceModifiers(highTechnical).prefersDetail).toBe(true);
    });
  });

  describe('detectTechnicalContent', () => {
    it('should detect technical terms', () => {
      expect(detectTechnicalContent('The API uses a neural network')).toBe(true);
      expect(detectTechnicalContent('Database optimization is key')).toBe(true);
      expect(detectTechnicalContent('The algorithm processes tensors')).toBe(true);
    });

    it('should return false for non-technical content', () => {
      expect(detectTechnicalContent('I love sunny days')).toBe(false);
      expect(detectTechnicalContent('The book was interesting')).toBe(false);
    });
  });

  describe('detectEmotionalContent', () => {
    it('should detect emotional terms', () => {
      expect(detectEmotionalContent('I feel happy about this')).toBe(true);
      expect(detectEmotionalContent('Love and hope matter')).toBe(true);
      expect(detectEmotionalContent('I understand your concern')).toBe(true);
    });

    it('should return false for non-emotional content', () => {
      expect(detectEmotionalContent('The code compiles successfully')).toBe(false);
      expect(detectEmotionalContent('2 + 2 equals 4')).toBe(false);
    });
  });
});
