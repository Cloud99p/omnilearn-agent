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

export function applyDeltas(state: CharacterState, delta: TraitDelta): Partial<CharacterState> {
  return {
    curiosity: clamp(state.curiosity + (delta.curiosity ?? 0)),
    caution: clamp(state.caution + (delta.caution ?? 0)),
    confidence: clamp(state.confidence + (delta.confidence ?? 0)),
    verbosity: clamp(state.verbosity + (delta.verbosity ?? 0)),
    technical: clamp(state.technical + (delta.technical ?? 0)),
    empathy: clamp(state.empathy + (delta.empathy ?? 0)),
    creativity: clamp(state.creativity + (delta.creativity ?? 0)),
  };
}

export function computeTraitDeltaFromLearning(
  newNodeCount: number,
  hadConflict: boolean,
  isTechnical: boolean,
  isEmotional: boolean,
): TraitDelta {
  const delta: TraitDelta = {};

  // Learning new things increases curiosity slightly
  if (newNodeCount > 0) {
    delta.curiosity = Math.min(newNodeCount * 0.4, 2.0);
    delta.confidence = Math.min(newNodeCount * 0.2, 1.0);
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

export function getVoiceModifiers(state: CharacterState): {
  openingTone: string;
  uncertaintyPhrase: string;
  closingStyle: string;
  prefersDetail: boolean;
} {
  const openings = [];
  if (state.curiosity > 70) openings.push("This is an interesting area.", "I find this topic compelling.");
  if (state.empathy > 65) openings.push("I understand what you're asking.", "Good question.");
  if (state.confidence > 70) openings.push("I have solid knowledge here.", "I can address this clearly.");
  if (openings.length === 0) openings.push("");

  const uncertaintyPhrases = [];
  if (state.caution > 65) uncertaintyPhrases.push("I should note my uncertainty here.", "This warrants careful consideration.");
  if (state.confidence < 35) uncertaintyPhrases.push("My confidence on this is limited.", "I may be incomplete here.");
  if (uncertaintyPhrases.length === 0) uncertaintyPhrases.push("My understanding suggests");

  const closings = [];
  if (state.curiosity > 65) closings.push("I am eager to learn more about this.", "There is more to explore here.");
  if (state.technical > 65) closings.push("The technical details merit further study.", "Precision matters in this domain.");
  if (closings.length === 0) closings.push("");

  return {
    openingTone: openings[Math.floor(Math.random() * openings.length)],
    uncertaintyPhrase: uncertaintyPhrases[Math.floor(Math.random() * uncertaintyPhrases.length)],
    closingStyle: closings[Math.floor(Math.random() * closings.length)],
    prefersDetail: state.verbosity > 55 || state.technical > 60,
  };
}

export function detectTechnicalContent(text: string): boolean {
  const technicalTerms = /\b(algorithm|api|database|neural|model|compute|server|protocol|function|code|system|architecture|network|memory|binary|hash|vector|tensor|inference|gradient|epoch|parameter|weight|layer|module|library|framework|runtime|kernel|daemon|process|thread|token|embed|latent)\b/i;
  return technicalTerms.test(text);
}

export function detectEmotionalContent(text: string): boolean {
  const emotionalTerms = /\b(feel|emotion|happy|sad|love|hate|fear|hope|trust|believe|value|care|important|matter|worry|concern|help|support|together|friend|community|people|human|life|experience|understand|empathy)\b/i;
  return emotionalTerms.test(text);
}
