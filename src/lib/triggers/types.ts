// ============================================
// Trigger Types - Common Types for All Triggers
// ============================================

import type { DetectedToken } from './token-detector';
import type { TriggerContext } from './trigger-bus';

// ============================================
// Trigger Match Types
// ============================================

export interface TriggerMatch {
  triggerId: string;
  triggerType: 'sound' | 'sprite' | 'background' | 'effect';
  keyword: string;
  data: Record<string, unknown>;
}

export type TriggerMatchResult = 
  | { matched: true; trigger: TriggerMatch; tokens: DetectedToken[] }
  | { matched: false };

// ============================================
// Trigger Handler Interface
// ============================================

export interface TriggerHandler {
  id: string;
  type: string;
  priority: number;
  
  /**
   * Check if this handler should process the tokens
   * Returns match result if should trigger
   */
  checkTrigger(
    tokens: DetectedToken[],
    context: TriggerContext,
    alreadyTriggered: Set<string>
  ): TriggerMatchResult | null;
  
  /**
   * Execute the trigger action
   */
  executeTrigger(match: TriggerMatch, context: TriggerContext): void;
  
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
