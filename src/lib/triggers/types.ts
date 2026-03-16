// ============================================
// Trigger Types - Common Types for All Triggers
// ============================================

import type { DetectedKey, KeyFormat, KeyCategory } from './key-detector';
import type { TriggerContext } from './trigger-bus';

// Re-export key detector types
export type { DetectedKey, KeyFormat, KeyCategory } from './key-detector';

// ============================================
// Trigger Match Types
// ============================================

export interface TriggerMatch {
  triggerId: string;
  triggerType: 'sound' | 'sprite' | 'background' | 'effect' | 'quest' | 'stats' | 'hud' | 'solicitud' | 'skill';
  keyword: string;
  data: Record<string, unknown>;
}

export type TriggerMatchResult = 
  | { matched: true; trigger: TriggerMatch; key: DetectedKey }
  | { matched: false };

// ============================================
// Key Handler Interface (Unified)
// ============================================

/**
 * Unified interface for all key handlers
 * 
 * Each handler:
 * 1. Receives DetectedKey[] from the unified KeyDetector
 * 2. Decides if the key belongs to it via canHandle()
 * 3. Processes the key via handleKey()
 * 4. Returns results for execution
 */
export interface KeyHandler {
  /** Unique handler identifier */
  id: string;
  
  /** Handler type for categorization */
  type: 'sound' | 'sprite' | 'background' | 'effect' | 'quest' | 'stats' | 'hud' | 'solicitud' | 'skill';
  
  /** Priority for handler ordering (higher = processed first) */
  priority: number;
  
  /**
   * Check if this handler should process a detected key
   * Returns true if the key matches this handler's domain
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean;
  
  /**
   * Process a key and return match result
   * Called only if canHandle() returned true
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null;
  
  /**
   * Execute the trigger action immediately
   * Called after handleKey() returns a match
   */
  execute(match: TriggerMatch, context: TriggerContext): void;
  
  /**
   * Batch process multiple keys (optional, for efficiency)
   * Default implementation calls handleKey() for each
   */
  handleKeys?(keys: DetectedKey[], context: TriggerContext): TriggerMatch[];
  
  /**
   * Get all registered keys for this handler
   * Used for word-based detection optimization
   */
  getRegisteredKeys?(context: TriggerContext): string[];
  
  /**
   * Reset state for new message
   */
  reset?(messageKey: string): void;
  
  /**
   * Cleanup when handler is removed
   */
  cleanup?(): void;
}

// ============================================
// Handler Result Types
// ============================================

export interface HandlerProcessResult {
  handlerId: string;
  matched: boolean;
  matches: TriggerMatch[];
}

// ============================================
// Cooldown Types
// ============================================

export interface CooldownConfig {
  global: number;
  perTrigger: number;
}

export interface CooldownState {
  lastGlobalTrigger: number;
  lastTriggerTimes: Map<string, number>;
}

// ============================================
// Legacy Types (for backward compatibility during migration)
// ============================================

import type { DetectedToken } from './token-detector';

export type LegacyTriggerMatchResult = 
  | { matched: true; trigger: TriggerMatch; tokens: DetectedToken[] }
  | { matched: false };

export interface LegacyTriggerHandler {
  id: string;
  type: string;
  priority: number;
  checkTrigger(
    tokens: DetectedToken[],
    context: TriggerContext,
    alreadyTriggered: Set<string>
  ): LegacyTriggerMatchResult | null;
  executeTrigger(match: TriggerMatch, context: TriggerContext): void;
  reset?(messageKey: string): void;
  cleanup?(): void;
}
