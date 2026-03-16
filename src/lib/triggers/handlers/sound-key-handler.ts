// ============================================
// Sound Key Handler - Unified KeyHandler Implementation
// ============================================
//
// Implements the KeyHandler interface for sound triggers.
// Works with DetectedKey[] from the unified KeyDetector.

import type { DetectedKey } from '../key-detector';
import type { KeyHandler, TriggerMatch, TriggerMatchResult } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type { SoundTrigger, SoundCollection } from '@/types';
import {
  createSoundHandlerState,
  checkSoundTriggersWithKeys,
  executeSoundTrigger,
  keyMatchesSoundKeyword,
  type SoundHandlerState,
  type SoundTriggerContext,
} from './sound-handler';

// ============================================
// Types
// ============================================

export interface SoundKeyHandlerContext extends TriggerContext {
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  soundSettings: {
    enabled: boolean;
    globalVolume: number;
    globalCooldown: number;
  };
  cooldownContextKey?: string;
}

// ============================================
// Sound Key Handler Class
// ============================================

export class SoundKeyHandler implements KeyHandler {
  readonly id = 'sound';
  readonly type = 'sound' as const;
  readonly priority = 100; // High priority - sounds should trigger quickly
  
  private state: SoundHandlerState;
  private maxSoundsPerMessage: number = 10;
  
  constructor(maxSoundsPerMessage: number = 10) {
    this.state = createSoundHandlerState();
    this.maxSoundsPerMessage = maxSoundsPerMessage;
  }
  
  /**
   * Check if this handler should process a detected key
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean {
    const soundContext = context as SoundKeyHandlerContext;
    
    // Check if sound is enabled
    if (!soundContext.soundSettings?.enabled) {
      return false;
    }
    
    // Check if any sound trigger matches this key
    const activeTriggers = soundContext.soundTriggers?.filter(t => t.active) || [];
    
    for (const trigger of activeTriggers) {
      for (const keyword of trigger.keywords) {
        if (keyMatchesSoundKeyword(key, keyword)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Process a key and return match result
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null {
    const soundContext = context as SoundKeyHandlerContext;
    
    // Get active triggers
    const activeTriggers = soundContext.soundTriggers?.filter(t => t.active) || [];
    
    // Find matching trigger
    for (const trigger of activeTriggers) {
      for (const keyword of trigger.keywords) {
        if (keyMatchesSoundKeyword(key, keyword)) {
          return {
            matched: true,
            trigger: {
              triggerId: trigger.id,
              triggerType: 'sound',
              keyword: keyword,
              data: {
                soundId: trigger.id,
                soundName: trigger.name,
                volume: (trigger.volume ?? 1) * (soundContext.soundSettings?.globalVolume ?? 0.85),
                collection: trigger.collection,
                playMode: trigger.playMode,
              },
            },
            key,
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Execute the trigger action immediately
   */
  execute(match: TriggerMatch, context: TriggerContext): void {
    const { soundUrl, volume, triggerName, keyword } = match.data as {
      soundUrl?: string;
      volume?: number;
      triggerName?: string;
      keyword?: string;
    };
    
    if (soundUrl) {
      executeSoundTrigger(match, context);
    }
  }
  
  /**
   * Batch process multiple keys
   */
  handleKeys(keys: DetectedKey[], context: TriggerContext): TriggerMatch[] {
    const soundContext = context as SoundKeyHandlerContext;
    
    const result = checkSoundTriggersWithKeys(
      keys,
      soundContext as SoundTriggerContext,
      this.state,
      this.maxSoundsPerMessage
    );
    
    // Execute all matched triggers
    if (result.matched && result.triggers.length > 0) {
      for (const { trigger } of result.triggers) {
        executeSoundTrigger(trigger, context);
      }
    }
    
    return result.triggers.map(t => t.trigger);
  }
  
  /**
   * Get all registered keys for word-based detection
   */
  getRegisteredKeys(context: TriggerContext): string[] {
    const soundContext = context as SoundKeyHandlerContext;
    const keys: string[] = [];
    
    const activeTriggers = soundContext.soundTriggers?.filter(t => t.active) || [];
    for (const trigger of activeTriggers) {
      keys.push(...trigger.keywords);
    }
    
    return keys;
  }
  
  /**
   * Reset state for new message
   */
  reset(messageKey: string): void {
    // Reset triggered positions for this message
    this.state.triggeredPositions.delete(messageKey);
    this.state.soundCountPerMessage.delete(messageKey);
  }
  
  /**
   * Cleanup
   */
  cleanup(): void {
    this.state.soundCountPerMessage.clear();
    this.state.triggeredPositions.clear();
  }
}

// ============================================
// Factory Function
// ============================================

export function createSoundKeyHandler(maxSoundsPerMessage: number = 10): SoundKeyHandler {
  return new SoundKeyHandler(maxSoundsPerMessage);
}
