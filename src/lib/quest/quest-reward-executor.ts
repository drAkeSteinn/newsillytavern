// ============================================
// Quest Reward Executor - Silent Reward Execution
// ============================================
//
// This module handles the execution of quest rewards.
// Rewards are executed SILENTLY - they update session state
// without showing messages in the chat.
//
// Reward Types:
// - attribute: Update character stats (HP, MP, gold, etc.)
// - sprite: Trigger sprite change
// - sound: Play a sound effect
// - background: Change the background
//
// Each reward can have an optional condition that must be met.

import type {
  QuestReward,
  QuestRewardCondition,
  QuestTemplate,
  SessionStats,
  CharacterCard,
} from '@/types';

// ============================================
// Types
// ============================================

export interface RewardExecutionContext {
  sessionId: string;
  characterId: string;
  character?: CharacterCard | null;
  sessionStats?: SessionStats;
  timestamp: number;
}

export interface RewardExecutionResult {
  rewardId: string;
  type: QuestReward['type'];
  key: string;
  value: string | number;
  success: boolean;
  message?: string;
  error?: string;
}

export interface RewardBatchResult {
  results: RewardExecutionResult[];
  successCount: number;
  failureCount: number;
  attributeUpdates: Map<string, number | string>; // key -> new value
  spriteTrigger?: string;
  soundTrigger?: string;
  backgroundTrigger?: string;
}

// ============================================
// Store Action Interface
// ============================================

/**
 * Interface for store actions needed to execute rewards
 * This allows decoupling from the actual store implementation
 */
export interface RewardStoreActions {
  // Attribute updates
  updateCharacterStat: (
    sessionId: string,
    characterId: string,
    attributeKey: string,
    value: number | string,
    reason?: 'llm_detection' | 'manual' | 'trigger' | 'initialization'
  ) => void;
  
  // Sprite triggers
  applyTriggerForCharacter?: (
    characterId: string,
    spriteUrl: string,
    returnToIdleMs?: number
  ) => void;
  
  // Sound triggers
  playSound?: (collection: string, filename: string, volume?: number) => void;
  
  // Background triggers
  setBackground?: (url: string) => void;
  setActiveOverlays?: (overlays: Array<{ url: string; position: string; opacity: number }>) => void;
}

// ============================================
// Condition Evaluation
// ============================================

/**
 * Evaluate a reward condition
 * Returns true if the condition is met, false otherwise
 */
export function evaluateRewardCondition(
  condition: QuestRewardCondition | undefined,
  sessionStats: SessionStats | undefined,
  characterId: string
): boolean {
  // No condition = always execute
  if (!condition) return true;
  
  // Currently only support attribute conditions
  if (condition.type !== 'attribute') return true;
  
  if (!sessionStats?.characterStats?.[characterId]) {
    return false;
  }
  
  const currentValue = sessionStats.characterStats[characterId].attributeValues?.[condition.key];
  
  if (currentValue === undefined) {
    return false;
  }
  
  const numValue = typeof currentValue === 'number' ? currentValue : parseFloat(currentValue);
  const conditionValue = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value);
  
  if (isNaN(numValue) || isNaN(conditionValue)) {
    // String comparison for non-numeric values
    const strValue = String(currentValue);
    const strCondition = String(condition.value);
    
    switch (condition.operator) {
      case '==': return strValue === strCondition;
      case '!=': return strValue !== strCondition;
      default: return true;
    }
  }
  
  // Numeric comparison
  switch (condition.operator) {
    case '<': return numValue < conditionValue;
    case '>': return numValue > conditionValue;
    case '<=': return numValue <= conditionValue;
    case '>=': return numValue >= conditionValue;
    case '==': return numValue === conditionValue;
    case '!=': return numValue !== conditionValue;
    default: return true;
  }
}

// ============================================
// Attribute Reward Execution
// ============================================

/**
 * Calculate new attribute value based on action
 */
export function calculateNewAttributeValue(
  currentValue: number | string | undefined,
  rewardValue: number | string,
  action: QuestReward['action'] = 'set'
): number | string {
  if (action === 'set') {
    return rewardValue;
  }
  
  const currentNum = typeof currentValue === 'number' 
    ? currentValue 
    : parseFloat(String(currentValue)) || 0;
  const rewardNum = typeof rewardValue === 'number' 
    ? rewardValue 
    : parseFloat(String(rewardValue)) || 0;
  
  switch (action) {
    case 'add':
      return currentNum + rewardNum;
    case 'subtract':
      return currentNum - rewardNum;
    case 'multiply':
      return currentNum * rewardNum;
    case 'divide':
      return rewardNum !== 0 ? currentNum / rewardNum : currentNum;
    case 'percent':
      // Add/subtract percentage of current value
      return currentNum + (currentNum * rewardNum / 100);
    default:
      return rewardValue;
  }
}

/**
 * Execute an attribute reward
 */
export function executeAttributeReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  const { sessionId, characterId, sessionStats } = context;
  
  try {
    // Get current value
    const currentValue = sessionStats?.characterStats?.[characterId]?.attributeValues?.[reward.key];
    
    // Calculate new value
    const newValue = calculateNewAttributeValue(currentValue, reward.value, reward.action);
    
    // Execute update with 'trigger' reason since this is from a quest reward
    storeActions.updateCharacterStat(
      sessionId,
      characterId,
      reward.key,
      newValue,
      'trigger'
    );
    
    return {
      rewardId: reward.id,
      type: 'attribute',
      key: reward.key,
      value: newValue,
      success: true,
      message: `${reward.key}: ${currentValue ?? 0} → ${newValue}`,
    };
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'attribute',
      key: reward.key,
      value: reward.value,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Sprite Reward Execution
// ============================================

/**
 * Execute a sprite reward
 * 
 * For sprites, the reward.key is the trigger keyword (e.g., "feliz", "victory")
 * The reward.value is the sprite URL (optional - if not provided, searches in character's spritePacks)
 * 
 * This function:
 * 1. If value is a URL, uses it directly
 * 2. If value is empty, searches for a matching sprite in character's spritePacks
 */
export function executeSpriteReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  const { characterId, character } = context;
  
  try {
    if (!storeActions.applyTriggerForCharacter) {
      return {
        rewardId: reward.id,
        type: 'sprite',
        key: reward.key,
        value: reward.value,
        success: false,
        error: 'Sprite actions not available',
      };
    }
    
    let spriteUrl: string | undefined;
    
    // Check if value is a URL
    const valueStr = String(reward.value || '');
    const isUrl = valueStr.startsWith('http') || valueStr.startsWith('/') || valueStr.startsWith('data:');
    
    if (isUrl) {
      // Use the URL directly
      spriteUrl = valueStr;
    } else if (valueStr) {
      // Value is a label/reference, try to find in character's sprites
      // First check spritePacks
      if (character?.spritePacks) {
        for (const pack of character.spritePacks) {
          if (!pack.active) continue;
          
          // Check if the key matches any pack keyword
          const keywords = pack.keywords || [];
          if (keywords.includes(reward.key) || keywords.includes(valueStr)) {
            // Found matching pack, get a sprite from items
            if (pack.items && pack.items.length > 0) {
              // Pick a random or first item
              const item = pack.playMode === 'random' 
                ? pack.items[Math.floor(Math.random() * pack.items.length)]
                : pack.items[pack.currentIndex || 0];
              
              if (item?.spriteUrl) {
                spriteUrl = item.spriteUrl;
                break;
              }
            }
          }
        }
      }
      
      // Check spriteTriggers if not found in packs
      if (!spriteUrl && character?.spriteTriggers) {
        const matchingTrigger = character.spriteTriggers.find(
          t => t.keywords.includes(reward.key) || t.keywords.includes(valueStr)
        );
        
        if (matchingTrigger?.spriteUrl) {
          spriteUrl = matchingTrigger.spriteUrl;
        }
      }
    } else {
      // No value provided, search by key in spritePacks
      if (character?.spritePacks) {
        for (const pack of character.spritePacks) {
          if (!pack.active) continue;
          
          const keywords = pack.keywords || [];
          if (keywords.includes(reward.key)) {
            if (pack.items && pack.items.length > 0) {
              const item = pack.items[pack.currentIndex || 0];
              if (item?.spriteUrl) {
                spriteUrl = item.spriteUrl;
                break;
              }
            }
          }
        }
      }
      
      // Check spriteTriggers
      if (!spriteUrl && character?.spriteTriggers) {
        const matchingTrigger = character.spriteTriggers.find(
          t => t.keywords.includes(reward.key)
        );
        
        if (matchingTrigger?.spriteUrl) {
          spriteUrl = matchingTrigger.spriteUrl;
        }
      }
    }
    
    // If still no sprite found, use a fallback or fail
    if (!spriteUrl) {
      console.log(`[QuestReward] No sprite found for key "${reward.key}" in character "${character?.name}"`);
      return {
        rewardId: reward.id,
        type: 'sprite',
        key: reward.key,
        value: reward.value,
        success: false,
        error: `No sprite found for trigger "${reward.key}"`,
      };
    }
    
    // Execute sprite change with optional return to idle
    const returnToIdleMs = reward.returnToIdleMs ?? 0;
    storeActions.applyTriggerForCharacter(characterId, spriteUrl, returnToIdleMs);
    
    return {
      rewardId: reward.id,
      type: 'sprite',
      key: reward.key,
      value: spriteUrl,
      success: true,
      message: `Sprite changed to: ${spriteUrl}${returnToIdleMs ? ` (returns in ${returnToIdleMs}ms)` : ''}`,
    };
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'sprite',
      key: reward.key,
      value: reward.value,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Sound Reward Execution
// ============================================

/**
 * Execute a sound reward
 */
export function executeSoundReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  try {
    if (!storeActions.playSound) {
      return {
        rewardId: reward.id,
        type: 'sound',
        key: reward.key,
        value: reward.value,
        success: false,
        error: 'Sound actions not available',
      };
    }
    
    // The key for sound rewards is the collection name
    // The value is the filename
    const collection = reward.key;
    const filename = String(reward.value);
    
    // Execute sound play
    storeActions.playSound(collection, filename, 0.8);
    
    return {
      rewardId: reward.id,
      type: 'sound',
      key: reward.key,
      value: reward.value,
      success: true,
      message: `Sound played: ${collection}/${filename}`,
    };
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'sound',
      key: reward.key,
      value: reward.value,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Background Reward Execution
// ============================================

/**
 * Execute a background reward
 */
export function executeBackgroundReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  try {
    if (!storeActions.setBackground) {
      return {
        rewardId: reward.id,
        type: 'background',
        key: reward.key,
        value: reward.value,
        success: false,
        error: 'Background actions not available',
      };
    }
    
    // The value for background rewards is the background URL
    const backgroundUrl = String(reward.value);
    
    // Execute background change
    storeActions.setBackground(backgroundUrl);
    
    return {
      rewardId: reward.id,
      type: 'background',
      key: reward.key,
      value: backgroundUrl,
      success: true,
      message: `Background changed to: ${backgroundUrl}`,
    };
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'background',
      key: reward.key,
      value: reward.value,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Item Reward Execution (Future)
// ============================================

/**
 * Execute an item reward
 * This is a placeholder for future inventory integration
 */
export function executeItemReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  return {
    rewardId: reward.id,
    type: 'item',
    key: reward.key,
    value: reward.value,
    success: false,
    error: 'Item rewards not yet implemented',
  };
}

// ============================================
// Custom Reward Execution
// ============================================

/**
 * Execute a custom reward
 * This allows for extensibility via custom handlers
 */
export function executeCustomReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  // Custom rewards can be handled by external systems
  // The key and value are passed through as-is
  return {
    rewardId: reward.id,
    type: 'custom',
    key: reward.key,
    value: reward.value,
    success: true,
    message: `Custom reward: ${reward.key} = ${reward.value}`,
  };
}

// ============================================
// Main Execution Functions
// ============================================

/**
 * Execute a single reward
 */
export function executeReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  // Check condition first
  if (!evaluateRewardCondition(reward.condition, context.sessionStats, context.characterId)) {
    return {
      rewardId: reward.id,
      type: reward.type,
      key: reward.key,
      value: reward.value,
      success: false,
      message: 'Condition not met',
    };
  }
  
  // Execute based on type
  switch (reward.type) {
    case 'attribute':
      return executeAttributeReward(reward, context, storeActions);
    case 'sprite':
      return executeSpriteReward(reward, context, storeActions);
    case 'sound':
      return executeSoundReward(reward, context, storeActions);
    case 'background':
      return executeBackgroundReward(reward, context, storeActions);
    case 'item':
      return executeItemReward(reward, context, storeActions);
    case 'custom':
      return executeCustomReward(reward, context, storeActions);
    default:
      return {
        rewardId: reward.id,
        type: reward.type,
        key: reward.key,
        value: reward.value,
        success: false,
        error: `Unknown reward type: ${reward.type}`,
      };
  }
}

/**
 * Execute all rewards for a quest
 * 
 * This is the main entry point for executing quest rewards.
 * Rewards are executed in order, and all are attempted
 * regardless of individual failures.
 */
export function executeAllRewards(
  rewards: QuestReward[],
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardBatchResult {
  const results: RewardExecutionResult[] = [];
  const attributeUpdates = new Map<string, number | string>();
  
  let spriteTrigger: string | undefined;
  let soundTrigger: string | undefined;
  let backgroundTrigger: string | undefined;
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const reward of rewards) {
    const result = executeReward(reward, context, storeActions);
    results.push(result);
    
    if (result.success) {
      successCount++;
      
      // Track specific triggers for UI feedback
      switch (reward.type) {
        case 'attribute':
          attributeUpdates.set(reward.key, result.value as number | string);
          break;
        case 'sprite':
          spriteTrigger = String(reward.value);
          break;
        case 'sound':
          soundTrigger = `${reward.key}:${reward.value}`;
          break;
        case 'background':
          backgroundTrigger = String(reward.value);
          break;
      }
    } else {
      failureCount++;
    }
  }
  
  return {
    results,
    successCount,
    failureCount,
    attributeUpdates,
    spriteTrigger,
    soundTrigger,
    backgroundTrigger,
  };
}

/**
 * Execute quest completion rewards
 * This is called when a quest is completed
 */
export function executeQuestCompletionRewards(
  template: QuestTemplate,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardBatchResult {
  if (!template.rewards || template.rewards.length === 0) {
    return {
      results: [],
      successCount: 0,
      failureCount: 0,
      attributeUpdates: new Map(),
    };
  }
  
  return executeAllRewards(template.rewards, context, storeActions);
}

/**
 * Execute objective completion rewards
 * This is called when an objective is completed (not just progressed)
 * 
 * @param objectiveRewards - Rewards defined in the objective template
 * @param context - Execution context with character/session info
 * @param storeActions - Store actions to execute rewards
 */
export function executeObjectiveRewards(
  objectiveRewards: QuestReward[],
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardBatchResult {
  if (!objectiveRewards || objectiveRewards.length === 0) {
    return {
      results: [],
      successCount: 0,
      failureCount: 0,
      attributeUpdates: new Map(),
    };
  }
  
  console.log(`[QuestReward] Executing ${objectiveRewards.length} objective rewards for character ${context.characterId}`);
  
  return executeAllRewards(objectiveRewards, context, storeActions);
}

// ============================================
// Reward Preview (For UI)
// ============================================

/**
 * Generate a human-readable description of a reward
 */
export function describeReward(reward: QuestReward): string {
  const actionStr = reward.action ? ` (${reward.action})` : '';
  
  switch (reward.type) {
    case 'attribute':
      const actionDesc: Record<string, string> = {
        'set': '=',
        'add': '+',
        'subtract': '-',
        'multiply': '×',
        'divide': '÷',
        'percent': '%+',
      };
      const symbol = reward.action ? actionDesc[reward.action] || '=' : '=';
      return `${reward.key} ${symbol} ${reward.value}`;
    case 'sprite':
      return `Sprite: ${reward.value}`;
    case 'sound':
      return `Sound: ${reward.key}/${reward.value}`;
    case 'background':
      return `Background: ${reward.value}`;
    case 'item':
      return `Item: ${reward.key} × ${reward.value}`;
    case 'custom':
      return `Custom: ${reward.key} = ${reward.value}`;
    default:
      return `${reward.type}: ${reward.key} = ${reward.value}`;
  }
}

/**
 * Generate a summary of all rewards
 */
export function describeRewards(rewards: QuestReward[]): string {
  return rewards.map(describeReward).join(', ');
}

// ============================================
// Export Index
// ============================================

export type {
  RewardExecutionContext,
  RewardExecutionResult,
  RewardBatchResult,
  RewardStoreActions,
};
