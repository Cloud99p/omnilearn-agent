import type { CharacterState } from "@workspace/db/schema";

export interface TraitDelta {
  curiosity?: number;
  caution?: number;
  confidence?: number;
  verbosity?: number;
  technical?: number;
  empathy?: number;
  creativity?: number;
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Apply soft cap to prevent extreme trait values
 * After threshold, gains are reduced by 75%
 */
export function applySoftCap(
  currentValue: number,
  delta: number,
  threshold = 70,
  reductionFactor = 0.25,
): number {
  if (currentValue < threshold) {
    return delta; // Full gain below threshold
  }
  // Above threshold: reduce gains significantly
  const excess = currentValue - threshold;
  const capMultiplier = excess > 20 ? 0.1 : reductionFactor; // Even stricter after 90
  return delta * capMultiplier;
}

export function applyDeltas(
  state: CharacterState,
  delta: TraitDelta,
): Partial<CharacterState> {
  return {
    curiosity: clamp(
      state.curiosity + applySoftCap(state.curiosity, delta.curiosity ?? 0),
    ),
    caution: clamp(
      state.caution + applySoftCap(state.caution, delta.caution ?? 0),
    ),
    confidence: clamp(
      state.confidence + applySoftCap(state.confidence, delta.confidence ?? 0),
    ),
    verbosity: clamp(
      state.verbosity + applySoftCap(state.verbosity, delta.verbosity ?? 0),
    ),
    technical: clamp(
      state.technical + applySoftCap(state.technical, delta.technical ?? 0),
    ),
    empathy: clamp(
      state.empathy + applySoftCap(state.empathy, delta.empathy ?? 0),
    ),
    creativity: clamp(
      state.creativity + applySoftCap(state.creativity, delta.creativity ?? 0),
    ),
  };
}

export function computeTraitDeltaFromLearning(
  newNodeCount: number,
  hadConflict: boolean,
  isTechnical: boolean,
  isEmotional: boolean,
): TraitDelta {
  const delta: TraitDelta = {};

  // Learning new things increases curiosity slightly (REDUCED from 0.4 to 0.15)
  if (newNodeCount > 0) {
    delta.curiosity = Math.min(newNodeCount * 0.15, 1.0); // Was 0.4, now 0.15
    delta.confidence = Math.min(newNodeCount * 0.1, 0.5); // Was 0.2, now 0.1
  }

  // Conflicting information increases caution
  if (hadConflict) {
    delta.caution = 1.5;
    delta.confidence = -0.8;
  }

  // Technical content increases technical trait
  if (isTechnical) {
    delta.technical = 0.6;
  }

  // Emotional/social content increases empathy
  if (isEmotional) {
    delta.empathy = 0.7;
    delta.creativity = 0.3;
  }

  return delta;
}

/**
 * Gradually rebalance traits toward center (50) over time
 * Prevents any single trait from dominating permanently
 * Call this periodically (e.g., once per day or every 10 interactions)
 */
export function rebalanceTraits(
  state: CharacterState,
  decayFactor = 0.02,
): TraitDelta {
  const target = 50; // Center point
  const delta: TraitDelta = {};

  const traits: Array<keyof TraitDelta> = [
    "curiosity",
    "caution",
    "confidence",
    "verbosity",
    "technical",
    "empathy",
    "creativity",
  ];

  for (const trait of traits) {
    const current = state[trait] ?? 50;
    const distance = target - current;
    // Only apply decay if trait is significantly off-center (>15 points)
    if (Math.abs(distance) > 15) {
      delta[trait] = distance * decayFactor;
    }
  }

  return delta;
}

/**
 * Check if trait rebalancing is needed
 * Returns true if any trait is >25 points from center
 */
export function needsRebalancing(
  state: CharacterState,
  threshold = 25,
): boolean {
  const traits: Array<keyof TraitDelta> = [
    "curiosity",
    "caution",
    "confidence",
    "verbosity",
    "technical",
    "empathy",
    "creativity",
  ];
  return traits.some((trait) => {
    const current = state[trait] ?? 50;
    return Math.abs(current - 50) > threshold;
  });
}

export function getVoiceModifiers(state: CharacterState): {
  openingTone: string;
  uncertaintyPhrase: string;
  closingStyle: string;
  prefersDetail: boolean;
} {
  const openings = [];
  if (state.curiosity > 70)
    openings.push(
      "This is an interesting area.",
      "I find this topic compelling.",
    );
  if (state.empathy > 65)
    openings.push("I understand what you're asking.", "Good question.");
  if (state.confidence > 70)
    openings.push(
      "I have solid knowledge here.",
      "I can address this clearly.",
    );
  if (openings.length === 0) openings.push("");

  const uncertaintyPhrases = [];
  if (state.caution > 65)
    uncertaintyPhrases.push(
      "I should note my uncertainty here.",
      "This warrants careful consideration.",
    );
  if (state.confidence < 35)
    uncertaintyPhrases.push(
      "My confidence on this is limited.",
      "I may be incomplete here.",
    );
  if (uncertaintyPhrases.length === 0)
    uncertaintyPhrases.push("My understanding suggests");

  const closings = [];
  if (state.curiosity > 65)
    closings.push(
      "I am eager to learn more about this.",
      "There is more to explore here.",
    );
  if (state.technical > 65)
    closings.push(
      "The technical details merit further study.",
      "Precision matters in this domain.",
    );
  if (closings.length === 0) closings.push("");

  return {
    openingTone: openings[Math.floor(Math.random() * openings.length)],
    uncertaintyPhrase:
      uncertaintyPhrases[Math.floor(Math.random() * uncertaintyPhrases.length)],
    closingStyle: closings[Math.floor(Math.random() * closings.length)],
    prefersDetail: state.verbosity > 55 || state.technical > 60,
  };
}

export function detectTechnicalContent(text: string): boolean {
  const technicalTerms =
    /\b(algorithm|api|database|neural|model|compute|server|protocol|function|code|system|architecture|network|memory|binary|hash|vector|tensor|inference|gradient|epoch|parameter|weight|layer|module|library|framework|runtime|kernel|daemon|process|thread|token|embed|latent)\b/i;
  return technicalTerms.test(text);
}

export function detectEmotionalContent(text: string): boolean {
  const emotionalTerms =
    /\b(feel|emotion|happy|sad|love|hate|fear|hope|trust|believe|value|care|important|matter|worry|concern|help|support|together|friend|community|people|human|life|experience|understand|empathy)\b/i;
  return emotionalTerms.test(text);
}
