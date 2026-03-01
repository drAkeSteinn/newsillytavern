// ============================================
// Stats Detector - Post-LLM detection of stat changes
// ============================================
//
// This module detects stat changes in LLM responses using
// detection tags defined in CharacterStatsConfig.attributes
//
// For example, if an attribute has:
//   detectionTags: "Vida:, HP:, ❤️"
//
// And the LLM response contains:
//   "...El golpe te afecta. Vida: 35..."
//
// It will detect the change from current value to 35

import type {
  CharacterStatsConfig,
  AttributeDefinition,
  SessionStats,
  StatsTriggerHit,
} from '@/types';

// ============================================
// Types
// ============================================

export interface AttributeDetection {
  attributeId: string;
  attributeKey: string;
  attributeName: string;
  oldValue: number | string | null;
  newValue: number | string;
  matchedText: string;
  matchedPattern: string;
  position: number;
}

export interface StatsDetectionResult {
  characterId: string;
  detections: AttributeDetection[];
  hasChanges: boolean;
}

// ============================================
// Detection Functions
// ============================================

/**
 * Parse a value based on attribute type
 */
export function parseStatValue(
  rawValue: string,
  attributeType: 'number' | 'keyword' | 'text'
): number | string {
  if (attributeType === 'number') {
    const num = parseFloat(rawValue);
    return isNaN(num) ? rawValue : num;
  }
  return rawValue.trim();
}

/**
 * Build regex pattern from detection tags
 * Converts "Vida:, HP:, ❤️" into a pattern that matches any tag followed by a value
 */
export function buildPatternFromTags(
  tags: string,
  caseSensitive: boolean = false
): RegExp | null {
  if (!tags.trim()) return null;
  
  // Split by comma and clean up
  const tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  if (tagList.length === 0) return null;
  
  // Escape special regex characters in each tag
  const escapedTags = tagList.map(tag => {
    return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  
  // Build pattern: (tag1|tag2|tag3)\s*(\S+)
  // This matches any tag followed by optional whitespace and then captures the value
  const patternStr = `(${escapedTags.join('|')})\\s*(-?\\d+(?:\\.\\d+)?|[^\\s,;.!?\\n]+)`;
  
  try {
    return new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/**
 * Detect attribute updates in text using detection tags
 */
export function detectAttributeUpdates(
  text: string,
  attributes: AttributeDefinition[],
  currentValues: Record<string, number | string> | undefined
): AttributeDetection[] {
  const detections: AttributeDetection[] = [];
  
  for (const attribute of attributes) {
    // Try new detectionTags format first
    let regex: RegExp | null = null;
    let patternSource: string = '';
    
    if (attribute.detectionTags) {
      regex = buildPatternFromTags(attribute.detectionTags, attribute.caseSensitive);
      patternSource = attribute.detectionTags;
    } 
    // Fallback to legacy keywordPattern for backward compatibility
    else if (attribute.keywordPattern) {
      try {
        regex = new RegExp(attribute.keywordPattern, 'gi');
        patternSource = attribute.keywordPattern;
      } catch (error) {
        console.error(`[StatsDetector] Invalid regex for attribute ${attribute.key}:`, error);
        continue;
      }
    }
    
    if (!regex) continue;
    
    try {
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // For new format: match[1] is the tag, match[2] is the value
        // For legacy format: match[1] is the value
        const rawValue = match[2] || match[1];
        if (!rawValue) continue;
        
        const newValue = parseStatValue(rawValue, attribute.type);
        const oldValue = currentValues?.[attribute.key] ?? null;
        
        // Only add if value changed
        if (oldValue !== newValue) {
          detections.push({
            attributeId: attribute.id,
            attributeKey: attribute.key,
            attributeName: attribute.name,
            oldValue,
            newValue,
            matchedText: match[0],
            matchedPattern: patternSource,
            position: match.index,
          });
        }
      }
    } catch (error) {
      console.error(`[StatsDetector] Error processing attribute ${attribute.key}:`, error);
    }
  }
  
  return detections;
}

/**
 * Detect all stat updates for a character in text
 */
export function detectStatsUpdates(
  text: string,
  characterId: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: SessionStats | undefined
): StatsDetectionResult {
  const emptyResult: StatsDetectionResult = {
    characterId,
    detections: [],
    hasChanges: false,
  };
  
  if (!statsConfig?.enabled || !statsConfig.attributes.length) {
    return emptyResult;
  }
  
  const charStats = sessionStats?.characterStats?.[characterId];
  const currentValues = charStats?.attributeValues;
  
  const detections = detectAttributeUpdates(
    text,
    statsConfig.attributes,
    currentValues
  );
  
  return {
    characterId,
    detections,
    hasChanges: detections.length > 0,
  };
}

/**
 * Convert detections to trigger hits for the trigger system
 */
export function detectionsToTriggerHits(
  detections: AttributeDetection[],
  characterId: string
): StatsTriggerHit[] {
  return detections.map(d => ({
    characterId,
    attributeId: d.attributeId,
    attributeKey: d.attributeKey,
    attributeName: d.attributeName,
    oldValue: d.oldValue,
    newValue: d.newValue,
    matchedPattern: d.matchedPattern,
    matchedText: d.matchedText,
  }));
}

// ============================================
// Streaming Support
// ============================================

/**
 * Stats detection state for streaming
 */
export class StatsDetectionState {
  private processedLength: number = 0;
  private detectedUpdates: Map<string, AttributeDetection> = new Map();
  
  /**
   * Process new text incrementally
   */
  processNewText(
    newText: string,
    fullText: string,
    attributes: AttributeDefinition[],
    currentValues: Record<string, number | string> | undefined
  ): AttributeDetection[] {
    // Look for patterns in recently added text
    // Use a window of the last 200 characters plus new text
    const windowStart = Math.max(0, this.processedLength - 200);
    const windowText = fullText.slice(windowStart);
    
    const newDetections = detectAttributeUpdates(
      windowText,
      attributes,
      currentValues
    );
    
    // Filter to only new detections
    const trulyNew = newDetections.filter(d => {
      const key = `${d.attributeKey}:${d.newValue}`;
      if (this.detectedUpdates.has(key)) {
        return false;
      }
      this.detectedUpdates.set(key, d);
      return true;
    });
    
    this.processedLength = fullText.length;
    
    return trulyNew;
  }
  
  /**
   * Reset state for new message
   */
  reset(): void {
    this.processedLength = 0;
    this.detectedUpdates.clear();
  }
  
  /**
   * Get all detected updates
   */
  getAllDetections(): AttributeDetection[] {
    return Array.from(this.detectedUpdates.values());
  }
}

/**
 * Create a new detection state
 */
export function createStatsDetectionState(): StatsDetectionState {
  return new StatsDetectionState();
}

// ============================================
// Trigger System Integration
// ============================================

/**
 * Stats trigger context for the trigger handler
 */
export interface StatsTriggerContext {
  characterId: string;
  fullText: string;
  isStreaming: boolean;
  messageKey: string;
  timestamp: number;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
}

/**
 * Stats handler result for trigger system
 */
export interface StatsHandlerResult {
  matched: boolean;
  hits: StatsTriggerHit[];
  detections: AttributeDetection[];
}

/**
 * Create stats handler state
 */
export function createStatsHandlerState() {
  return {
    detectionStates: new Map<string, StatsDetectionState>(),
  };
}

/**
 * Check stats triggers during streaming
 */
export function checkStatsTriggers(
  context: StatsTriggerContext,
  handlerState: { detectionStates: Map<string, StatsDetectionState> }
): StatsHandlerResult {
  const { characterId, fullText, statsConfig, sessionStats } = context;
  
  if (!statsConfig?.enabled) {
    return { matched: false, hits: [], detections: [] };
  }
  
  // Get or create detection state for this character
  let state = handlerState.detectionStates.get(characterId);
  if (!state) {
    state = createStatsDetectionState();
    handlerState.detectionStates.set(characterId, state);
  }
  
  const charStats = sessionStats?.characterStats?.[characterId];
  const currentValues = charStats?.attributeValues;
  
  // Process new text
  const newDetections = state.processNewText(
    fullText,
    fullText,
    statsConfig.attributes,
    currentValues
  );
  
  if (newDetections.length === 0) {
    return { matched: false, hits: [], detections: [] };
  }
  
  // Convert to trigger hits
  const hits = detectionsToTriggerHits(newDetections, characterId);
  
  return {
    matched: true,
    hits,
    detections: newDetections,
  };
}

/**
 * Reset stats handler state for new message
 */
export function resetStatsHandlerState(
  handlerState: { detectionStates: Map<string, StatsDetectionState> },
  characterId: string
): void {
  const state = handlerState.detectionStates.get(characterId);
  if (state) {
    state.reset();
  }
}
