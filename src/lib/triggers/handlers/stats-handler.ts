// ============================================
// Stats Handler - Handles Stats Updates Post-LLM
// ============================================
//
// This handler detects stat changes in LLM responses
// using keyword patterns defined in CharacterStatsConfig.attributes
//
// For example:
// - LLM response contains "Vida: 35"
// - Handler detects pattern match
// - Updates sessionStats for the responding character

import type { TriggerMatch } from '../types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type {
  CharacterStatsConfig,
  SessionStats,
  StatsTriggerHit,
  AttributeDefinition,
} from '@/types';
import {
  detectStatsUpdates,
  createStatsDetectionState,
  checkStatsTriggers,
  resetStatsHandlerState as resetDetectorState,
  type StatsDetectionState,
  type StatsDetectionResult,
  type AttributeDetection,
} from '@/lib/stats/stats-detector';

// ============================================
// Stats Handler State
// ============================================

export interface StatsHandlerState {
  detectionStates: Map<string, StatsDetectionState>;
  processedMessages: Set<string>;
}

export function createStatsHandlerState(): StatsHandlerState {
  return {
    detectionStates: new Map(),
    processedMessages: new Set(),
  };
}

// ============================================
// Stats Trigger Context
// ============================================

export interface StatsTriggerContext extends TriggerContext {
  characterId: string;  // The character currently responding
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
}

export interface StatsHandlerResult {
  matched: boolean;
  triggers: Array<{
    trigger: TriggerMatch;
    detections: AttributeDetection[];
  }>;
  allDetections: AttributeDetection[];
}

// ============================================
// Stats Handler Functions
// ============================================

/**
 * Check stats triggers during streaming or at message end
 *
 * This function processes the text to find stat update patterns
 * and returns trigger matches for the trigger system.
 */
export function checkStatsTriggersInText(
  text: string,
  context: StatsTriggerContext,
  state: StatsHandlerState
): StatsHandlerResult {
  const { characterId, statsConfig, sessionStats, messageKey } = context;

  const result: StatsHandlerResult = {
    matched: false,
    triggers: [],
    allDetections: [],
  };

  // Check if stats system is enabled
  if (!statsConfig?.enabled) {
    return result;
  }

  // Get or create detection state for this character
  let detectionState = state.detectionStates.get(characterId);
  if (!detectionState) {
    detectionState = createStatsDetectionState();
    state.detectionStates.set(characterId, detectionState);
  }

  // Get current values for this character
  const charStats = sessionStats?.characterStats?.[characterId];
  const currentValues = charStats?.attributeValues;

  // Process text for new detections
  const newDetections = detectionState.processNewText(
    text,
    text,
    statsConfig.attributes,
    currentValues
  );

  if (newDetections.length === 0) {
    return result;
  }

  // Convert detections to trigger matches
  for (const detection of newDetections) {
    result.triggers.push({
      trigger: {
        triggerId: `stats_${detection.attributeId}`,
        triggerType: 'stats',
        keyword: detection.attributeKey,
        data: {
          characterId,
          attributeId: detection.attributeId,
          attributeKey: detection.attributeKey,
          attributeName: detection.attributeName,
          oldValue: detection.oldValue,
          newValue: detection.newValue,
          matchedPattern: detection.matchedPattern,
          matchedText: detection.matchedText,
        },
      },
      detections: [detection],
    });
    result.allDetections.push(detection);
  }

  result.matched = true;

  console.log(`[StatsHandler] Detected ${newDetections.length} stat changes for ${characterId}`);

  return result;
}

/**
 * Execute stats trigger - Update the stat value in store
 *
 * This should be called by the trigger system when a stats match is found.
 * The actual store update should be done via the statsSlice actions.
 */
export function executeStatsTrigger(
  match: TriggerMatch,
  context: TriggerContext,
  storeActions?: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger'
    ) => void;
    getSessionId: () => string | null;
  }
): StatsTriggerHit | null {
  const data = match.data as {
    characterId: string;
    attributeId: string;
    attributeKey: string;
    attributeName: string;
    oldValue: number | string | null;
    newValue: number | string;
    matchedPattern: string;
    matchedText: string;
  };

  // If store actions are provided, update the stat
  if (storeActions) {
    const sessionId = storeActions.getSessionId();
    if (sessionId) {
      storeActions.updateCharacterStat(
        sessionId,
        data.characterId,
        data.attributeKey,
        data.newValue,
        'llm_detection'
      );
    }
  }

  // Return the trigger hit for UI updates
  return {
    characterId: data.characterId,
    attributeId: data.attributeId,
    attributeKey: data.attributeKey,
    attributeName: data.attributeName,
    oldValue: data.oldValue,
    newValue: data.newValue,
    matchedPattern: data.matchedPattern,
    matchedText: data.matchedText,
  };
}

/**
 * Execute all stats triggers from a result
 */
export function executeAllStatsTriggers(
  result: StatsHandlerResult,
  context: TriggerContext,
  storeActions?: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger'
    ) => void;
    getSessionId: () => string | null;
  }
): StatsTriggerHit[] {
  if (!result.matched || result.triggers.length === 0) return [];

  const hits: StatsTriggerHit[] = [];

  for (const { trigger } of result.triggers) {
    const hit = executeStatsTrigger(trigger, context, storeActions);
    if (hit) {
      hits.push(hit);
    }
  }

  return hits;
}

/**
 * Reset state for new message
 */
export function resetStatsHandlerState(
  state: StatsHandlerState,
  characterId: string,
  messageKey: string
): void {
  const detectionState = state.detectionStates.get(characterId);
  if (detectionState) {
    detectionState.reset();
  }
  state.processedMessages.delete(messageKey);
}

/**
 * Clear all detection states (e.g., when changing sessions)
 */
export function clearStatsHandlerState(state: StatsHandlerState): void {
  state.detectionStates.clear();
  state.processedMessages.clear();
}

// ============================================
// Full Text Detection (Non-Streaming)
// ============================================

/**
 * Detect stats updates in complete text (non-streaming mode)
 *
 * Use this when processing a complete message after streaming ends.
 */
export function detectStatsInFullText(
  text: string,
  characterId: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: SessionStats | undefined
): StatsDetectionResult {
  return detectStatsUpdates(text, characterId, statsConfig, sessionStats);
}

// ============================================
// Batch Processing for Group Chats
// ============================================

/**
 * Process stats for multiple characters (group chat)
 *
 * In a group chat, each character may have different stats.
 * This function processes all characters' stats in one pass.
 */
export function processGroupStats(
  text: string,
  characters: Array<{
    id: string;
    statsConfig?: CharacterStatsConfig;
  }>,
  sessionStats: SessionStats | undefined,
  state: StatsHandlerState
): Map<string, StatsHandlerResult> {
  const results = new Map<string, StatsHandlerResult>();

  for (const char of characters) {
    if (!char.statsConfig?.enabled) continue;

    const context: StatsTriggerContext = {
      characterId: char.id,
      character: null,
      fullText: text,
      isStreaming: false,
      messageKey: `group_${Date.now()}`,
      timestamp: Date.now(),
      statsConfig: char.statsConfig,
      sessionStats,
    };

    const result = checkStatsTriggersInText(text, context, state);
    if (result.matched) {
      results.set(char.id, result);
    }
  }

  return results;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all attribute patterns for a character
 * Useful for debugging or pattern testing
 */
export function getAttributePatterns(
  statsConfig: CharacterStatsConfig | undefined
): Array<{ key: string; pattern: string }> {
  if (!statsConfig?.attributes) return [];

  return statsConfig.attributes
    .filter(attr => attr.keywordPattern)
    .map(attr => ({
      key: attr.key,
      pattern: attr.keywordPattern!,
    }));
}

/**
 * Test a pattern against text
 * Returns matched groups if found
 */
export function testPattern(
  text: string,
  pattern: string
): RegExpMatchArray | null {
  try {
    const regex = new RegExp(pattern, 'gi');
    return text.match(regex);
  } catch {
    return null;
  }
}
