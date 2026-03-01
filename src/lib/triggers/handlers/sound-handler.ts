// ============================================
// Sound Handler - Handles Sound Triggers
// ============================================

import type { TriggerMatch } from '../types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { SoundTrigger, SoundCollection } from '@/types';
import { getCooldownManager } from '../cooldown-manager';

// ============================================
// Audio Queue System
// ============================================

interface QueueItem {
  src: string;
  volume: number;
  triggerName: string;
  keyword: string;
}

const audioQueue: QueueItem[] = [];
let isPlaying = false;

async function processAudioQueue(): Promise<void> {
  if (isPlaying || audioQueue.length === 0) return;
  
  isPlaying = true;
  
  while (audioQueue.length > 0) {
    const item = audioQueue.shift();
    if (!item) break;
    
    try {
      console.log(`[SoundHandler] Playing: ${item.triggerName} (keyword: ${item.keyword})`);
      const audio = new Audio(item.src);
      audio.volume = Math.min(1, Math.max(0, item.volume));
      
      await audio.play();
      
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        setTimeout(() => resolve(), 5000);
      });
      
      // Small gap between sounds
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      console.warn('[SoundHandler] Failed to play:', item.src, error);
    }
  }
  
  isPlaying = false;
}

// ============================================
// Cycle Index Tracking
// ============================================

const triggerCycleIndexes = new Map<string, number>();

function getCycleIndex(triggerId: string, maxFiles: number): number {
  const current = triggerCycleIndexes.get(triggerId) || 0;
  const nextIndex = (current + 1) % maxFiles;
  triggerCycleIndexes.set(triggerId, nextIndex);
  return current;
}

function getRandomIndex(maxFiles: number): number {
  return Math.floor(Math.random() * maxFiles);
}

// ============================================
// Sound Handler State
// ============================================

export interface SoundHandlerState {
  soundCountPerMessage: Map<string, number>;
  triggeredPositions: Map<string, Set<number>>;
}

export function createSoundHandlerState(): SoundHandlerState {
  return {
    soundCountPerMessage: new Map(),
    triggeredPositions: new Map(),
  };
}

// ============================================
// Sound Trigger Context
// ============================================

export interface SoundTriggerContext extends TriggerContext {
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  soundSettings: {
    enabled: boolean;
    globalVolume: number;
    globalCooldown: number;
  };
  cooldownContextKey?: string;  // Key for cooldown tracking (e.g., character ID)
}

export interface SoundHandlerResult {
  matched: boolean;
  triggers: Array<{
    trigger: TriggerMatch;
    tokens: DetectedToken[];
  }>;
}

// ============================================
// Sound Handler Functions
// ============================================

/**
 * Check sound triggers - Returns ALL matches found
 * 
 * Cooldown behavior:
 * - globalCooldown=0: No global cooldown (sounds play freely)
 * - trigger.cooldown=0: No per-trigger cooldown
 * - Both >0: Both cooldowns are enforced
 */
export function checkSoundTriggers(
  tokens: DetectedToken[],
  context: SoundTriggerContext,
  state: SoundHandlerState,
  maxSoundsPerMessage: number = 10
): SoundHandlerResult {
  const { soundTriggers, soundCollections, soundSettings, cooldownContextKey } = context;
  
  const result: SoundHandlerResult = {
    matched: false,
    triggers: [],
  };
  
  // Check if sound is enabled
  if (!soundSettings?.enabled) {
    return result;
  }
  
  // Get cooldown manager and config
  const cooldownManager = getCooldownManager();
  const cooldownKey = cooldownContextKey || 'default';
  const globalCooldown = soundSettings.globalCooldown ?? 0;
  
  // Get current count (mutable reference for this call)
  let currentCount = state.soundCountPerMessage.get(context.messageKey) ?? 0;
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set<number>();
  
  const activeTriggers = soundTriggers.filter(t => t.active);
  
  console.log(`[SoundHandler] Processing ${tokens.length} tokens, globalCooldown=${globalCooldown}ms`);
  
  // Process ALL tokens and find ALL matches
  for (const token of tokens) {
    // Stop if we've hit the max sounds limit
    if (currentCount >= maxSoundsPerMessage) {
      console.log(`[SoundHandler] Max sounds per message reached: ${maxSoundsPerMessage}`);
      break;
    }
    
    // Skip if this position already triggered
    if (triggered.has(token.wordPosition)) {
      continue;
    }
    
    for (const trigger of activeTriggers) {
      // Stop if we've hit the max sounds limit
      if (currentCount >= maxSoundsPerMessage) {
        break;
      }
      
      // Check keywords
      const matchingKeyword = trigger.keywords.find(kw => {
        // Check if keyword is disabled
        if (trigger.keywordsEnabled?.[kw] === false) {
          return false;
        }
        return checkTokenMatch(token, kw);
      });
      
      if (!matchingKeyword) continue;
      
      // Check cooldown ONLY if cooldown values > 0
      // If cooldown is 0, sounds play freely without restriction
      const triggerCooldown = trigger.cooldown ?? 0;
      
      if (globalCooldown > 0 || triggerCooldown > 0) {
        const isReady = cooldownManager.isReady(cooldownKey, trigger.id, {
          global: globalCooldown,
          perTrigger: triggerCooldown,
        });
        
        if (!isReady) {
          console.log(`[SoundHandler] Trigger "${trigger.name}" on cooldown, skipping`);
          continue;
        }
      }
      
      // Get sound file
      const soundFile = getSoundFile(trigger, soundCollections);
      if (!soundFile) continue;
      
      // Mark as triggered
      triggered.add(token.wordPosition);
      
      // Mark cooldown as fired (if cooldown is enabled)
      if (globalCooldown > 0 || triggerCooldown > 0) {
        cooldownManager.markFired(cooldownKey, trigger.id);
      }
      
      // Increment count
      currentCount++;
      
      // Add to results
      result.triggers.push({
        trigger: {
          triggerId: trigger.id,
          triggerType: 'sound',
          keyword: matchingKeyword,
          data: {
            soundUrl: soundFile,
            volume: (trigger.volume ?? 1) * soundSettings.globalVolume,
            triggerName: trigger.name,
          },
        },
        tokens: [token],
      });
      
      result.matched = true;
      
      console.log(`[SoundHandler] Queued: "${trigger.name}" (keyword: ${matchingKeyword})`);
      
      // Break inner loop to continue with next token (one trigger per token position)
      break;
    }
  }
  
  // Update state with new count and triggered positions
  state.soundCountPerMessage.set(context.messageKey, currentCount);
  state.triggeredPositions.set(context.messageKey, triggered);
  
  if (result.triggers.length > 0) {
    console.log(`[SoundHandler] Total sounds queued: ${result.triggers.length}`);
  }
  
  return result;
}

/**
 * Execute sound trigger - Adds to queue
 */
export function executeSoundTrigger(match: TriggerMatch, context: TriggerContext): void {
  const { soundUrl, volume, triggerName, keyword } = match.data as {
    soundUrl: string;
    volume: number;
    triggerName: string;
    keyword?: string;
  };
  
  // Add to queue
  audioQueue.push({
    src: soundUrl,
    volume,
    triggerName,
    keyword: keyword || '',
  });
  
  // Process queue if not already playing
  if (!isPlaying) {
    processAudioQueue();
  }
}

/**
 * Execute all sound triggers from a result
 */
export function executeAllSoundTriggers(
  result: SoundHandlerResult, 
  context: TriggerContext
): void {
  if (!result.matched || result.triggers.length === 0) return;
  
  console.log(`[SoundHandler] Queueing ${result.triggers.length} sound(s)`);
  
  for (const { trigger } of result.triggers) {
    executeSoundTrigger(trigger, context);
  }
}

/**
 * Reset state for new message
 */
export function resetSoundHandlerState(state: SoundHandlerState, messageKey: string): void {
  state.soundCountPerMessage.set(messageKey, 0);
  state.triggeredPositions.delete(messageKey);
}

/**
 * Reset cooldown for a context (call when changing characters/sessions)
 */
export function resetSoundCooldowns(contextKey: string): void {
  const cooldownManager = getCooldownManager();
  cooldownManager.reset(contextKey);
}

/**
 * Clear all sound cooldowns
 */
export function clearAllSoundCooldowns(): void {
  const cooldownManager = getCooldownManager();
  cooldownManager.resetAll();
}

/**
 * Clear the audio queue (stop pending sounds)
 */
export function clearAudioQueue(): void {
  audioQueue.length = 0;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get sound file from trigger's collection
 */
function getSoundFile(trigger: SoundTrigger, collections: SoundCollection[]): string | null {
  const collection = collections.find(c => c.name === trigger.collection);
  
  if (!collection || collection.files.length === 0) {
    return null;
  }
  
  let soundIndex: number;
  if (trigger.playMode === 'random') {
    soundIndex = getRandomIndex(collection.files.length);
  } else {
    soundIndex = getCycleIndex(trigger.id, collection.files.length);
  }
  
  return collection.files[soundIndex] || null;
}

/**
 * Check if token matches keyword
 */
function checkTokenMatch(token: DetectedToken, keyword: string): boolean {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const normalizedToken = token.token.toLowerCase();
  
  if (!normalizedKeyword || !normalizedToken) return false;
  
  return normalizedToken.includes(normalizedKeyword) || 
         normalizedKeyword.includes(normalizedToken);
}
