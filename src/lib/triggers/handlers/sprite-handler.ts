// ============================================
// Sprite Handler - Handles Sprite Triggers
// ============================================

import type { TriggerMatch } from '../types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { 
  SpritePack, 
  SpritePackItem, 
  CharacterCard,
  CharacterSpriteTrigger,
  SpriteLibraryEntry,
} from '@/types';

// ============================================
// Sprite Handler State
// ============================================

export interface SpriteHandlerState {
  triggeredPositions: Map<string, Set<number>>;
  lastPackMatches: Map<string, string>;
}

export function createSpriteHandlerState(): SpriteHandlerState {
  return {
    triggeredPositions: new Map(),
    lastPackMatches: new Map(),
  };
}

// ============================================
// Sprite Trigger Context
// ============================================

export interface SpriteTriggerContext extends TriggerContext {
  spritePacks: SpritePack[];
  spriteTriggers: CharacterSpriteTrigger[];
  spriteIndex: { sprites: Array<{ label: string; url: string }> };
  spriteLibraries: {
    actions: SpriteLibraryEntry[];
    poses: SpriteLibraryEntry[];
    clothes: SpriteLibraryEntry[];
  };
  isSpriteLocked: boolean;
}

export interface SpriteHandlerResult {
  matched: boolean;
  trigger: TriggerMatch;
  tokens: DetectedToken[];
}

// ============================================
// Key Extraction Helper
// ============================================

/**
 * Get all keys from a trigger (main key + alternatives + legacy keywords)
 * Supports both new key/keys system and legacy keywords field
 */
function getAllTriggerKeys(trigger: CharacterSpriteTrigger): string[] {
  const allKeys: string[] = [];
  
  // New system: main key
  if (trigger.key) {
    allKeys.push(trigger.key);
  }
  
  // New system: alternative keys
  if (trigger.keys && trigger.keys.length > 0) {
    allKeys.push(...trigger.keys);
  }
  
  // Legacy: keywords (only if no new keys defined)
  if (allKeys.length === 0 && trigger.keywords && trigger.keywords.length > 0) {
    allKeys.push(...trigger.keywords);
  }
  
  return allKeys;
}

// ============================================
// Sprite Handler Functions
// ============================================

/**
 * Check sprite triggers
 */
export function checkSpriteTriggers(
  tokens: DetectedToken[],
  context: SpriteTriggerContext,
  state: SpriteHandlerState
): SpriteHandlerResult | null {
  const { spritePacks, spriteTriggers, spriteIndex, spriteLibraries, isSpriteLocked, character } = context;
  
  // Check if sprite is locked
  if (isSpriteLocked) {
    return null;
  }
  
  if (!character) {
    return null;
  }
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set();
  
  // Try sprite packs first (higher priority)
  const packResult = checkSpritePacks(
    tokens, 
    spritePacks, 
    spriteIndex, 
    spriteLibraries, 
    triggered, 
    context
  );
  
  if (packResult) {
    if (packResult.tokens[0]?.wordPosition !== undefined) {
      triggered.add(packResult.tokens[0].wordPosition);
      state.triggeredPositions.set(context.messageKey, triggered);
    }
    return packResult;
  }
  
  // Try simple triggers
  const simpleResult = checkSimpleTriggers(
    tokens, 
    spriteTriggers, 
    triggered, 
    context
  );
  
  if (simpleResult) {
    if (simpleResult.tokens[0]?.wordPosition !== undefined) {
      triggered.add(simpleResult.tokens[0].wordPosition);
      state.triggeredPositions.set(context.messageKey, triggered);
    }
    return simpleResult;
  }
  
  return null;
}

/**
 * Check sprite packs (ANY pack keyword + ALL item keys)
 */
function checkSpritePacks(
  tokens: DetectedToken[],
  packs: SpritePack[],
  spriteIndex: { sprites: Array<{ label: string; url: string }> },
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  triggeredPositions: Set<number>,
  context: SpriteTriggerContext
): SpriteHandlerResult | null {
  const activePacks = packs.filter(p => p.active);
  
  for (const token of tokens) {
    if (token.wordPosition !== undefined && triggeredPositions.has(token.wordPosition)) continue;
    
    for (const pack of activePacks) {
      // Check pack keywords (ANY keyword must match)
      const matchingKeyword = pack.keywords.find(kw => 
        tokenMatchesKeyword(token, kw, pack.caseSensitive ?? false)
      );
      
      if (!matchingKeyword) continue;
      
      // Find best matching item (ALL keys must match)
      const bestItem = findBestMatchingItem(
        tokens,
        pack.items?.filter(i => i.enabled !== false) ?? [],
        libraries,
        pack.caseSensitive ?? false,
        pack.requirePipes ?? false
      );
      
      if (!bestItem) continue;
      
      // Get sprite URL
      const spriteUrl = getSpriteUrl(bestItem, spriteIndex);
      if (!spriteUrl) continue;
      
      return {
        matched: true,
        trigger: {
          triggerId: pack.id,
          triggerType: 'sprite',
          keyword: matchingKeyword,
          data: {
            spriteUrl,
            spriteLabel: bestItem.spriteLabel,
            returnToIdleMs: bestItem.returnToIdleMs ?? 0,
            characterId: context.character?.id,
            packId: pack.id,
            triggerName: pack.name,
          },
        },
        tokens: [token],
      };
    }
  }
  
  return null;
}

/**
 * Check simple sprite triggers (ANY key)
 * 
 * PRIORITY SYSTEM:
 * - Triggers are sorted by priority (descending)
 * - Higher priority triggers match first
 * - requirePipes: If true, keyword must be in |pipes| format
 * - Supports new key/keys system AND legacy keywords field
 */
function checkSimpleTriggers(
  tokens: DetectedToken[],
  triggers: CharacterSpriteTrigger[],
  triggeredPositions: Set<number>,
  context: SpriteTriggerContext
): SpriteHandlerResult | null {
  // Filter active triggers and sort by priority (highest first)
  const activeTriggers = triggers
    .filter(t => t.active)
    .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1));
  
  // Separate tokens by type
  const pipeTokens = tokens.filter(t => t.type === 'pipe');
  const allTokens = tokens;
  
  for (const trigger of activeTriggers) {
    // Determine which tokens to check based on requirePipes
    const tokensToCheck = trigger.requirePipes ? pipeTokens : allTokens;
    
    // Get all keys (new key/keys system + legacy keywords)
    const allKeys = getAllTriggerKeys(trigger);
    
    for (const token of tokensToCheck) {
      if (token.wordPosition !== undefined && triggeredPositions.has(token.wordPosition)) continue;
      
      const matchingKey = allKeys.find(key =>
        tokenMatchesKeyword(token, key, trigger.caseSensitive ?? false)
      );
      
      if (!matchingKey) continue;
      
      // Verify sprite URL exists
      const spriteUrl = trigger.spriteUrl;
      if (!spriteUrl) continue;
      
      return {
        matched: true,
        trigger: {
          triggerId: trigger.id,
          triggerType: 'sprite',
          keyword: matchingKey,
          data: {
            spriteUrl,
            spriteLabel: trigger.spriteState,
            returnToIdleMs: trigger.returnToIdleMs ?? 0,
            characterId: context.character?.id,
            returnToMode: trigger.returnToMode,
            returnToSpriteUrl: trigger.returnToSpriteUrl,
            priority: trigger.priority ?? 1,
          },
        },
        tokens: [token],
      };
    }
  }
  
  return null;
}

/**
 * Find best matching item from pack (ALL keys must match)
 */
function findBestMatchingItem(
  tokens: DetectedToken[],
  items: SpritePackItem[],
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  caseSensitive: boolean,
  requirePipes: boolean
): SpritePackItem | null {
  let bestItem: SpritePackItem | null = null;
  let bestKeyCount = 0;
  
  for (const item of items) {
    if (!item.spriteLabel && !item.spriteUrl) continue;
    
    const keys = buildItemKeys(item, libraries);
    
    // If no keys, item matches on pack keyword alone
    if (keys.length === 0) {
      if (!bestItem) {
        bestItem = item;
      }
      continue;
    }
    
    // ALL keys must match
    const allKeysMatch = keys.every(key => {
      const tokensToCheck = requirePipes 
        ? tokens.filter(t => t.type === 'pipe') 
        : tokens;
      return tokensToCheck.some(t => tokenMatchesKeyword(t, key, caseSensitive));
    });
    
    if (allKeysMatch && keys.length > bestKeyCount) {
      bestItem = item;
      bestKeyCount = keys.length;
    }
  }
  
  return bestItem;
}

/**
 * Build keys from item libraries + manual keys
 */
function buildItemKeys(
  item: SpritePackItem,
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] }
): string[] {
  const keys: string[] = [];
  
  // Library keys
  const action = libraries.actions.find(a => a.id === item.actionId);
  const pose = libraries.poses.find(p => p.id === item.poseId);
  const clothes = libraries.clothes.find(c => c.id === item.clothesId);
  
  if (action) keys.push(`${action.prefix}${action.name}`);
  if (pose) keys.push(`${pose.prefix}${pose.name}`);
  if (clothes) keys.push(`${clothes.prefix}${clothes.name}`);
  
  // Manual keys
  if (item.keys) {
    keys.push(...item.keys.split(',').map(k => k.trim()).filter(Boolean));
  }
  
  return [...new Set(keys)]; // Deduplicate
}

/**
 * Get sprite URL from item
 */
function getSpriteUrl(
  item: SpritePackItem,
  spriteIndex: { sprites: Array<{ label: string; url: string }> }
): string | null {
  if (item.spriteUrl) return item.spriteUrl;
  
  if (item.spriteLabel) {
    const entry = spriteIndex.sprites.find(s => s.label === item.spriteLabel);
    return entry?.url || null;
  }
  
  return null;
}

/**
 * Check if token matches keyword
 * 
 * Matching rules:
 * - Single-word keyword: Requires EXACT match (no partial matches)
 * - Multi-word keyword: Checks if all words appear in token or if keyword appears as substring
 * 
 * This prevents false positives like:
 * - "marisa" triggering "risa" (no longer matches)
 * - "alegría" triggering "ale" (no longer matches)
 */
function tokenMatchesKeyword(token: DetectedToken, keyword: string, caseSensitive: boolean): boolean {
  const kw = caseSensitive ? keyword : keyword.toLowerCase();
  const tk = caseSensitive ? token.token : token.token.toLowerCase();
  
  if (!kw || !tk) return false;
  
  // For single-word keywords, require EXACT match
  // This prevents false positives like "marisa" matching "risa"
  const keywordWords = kw.split(/\s+/);
  if (keywordWords.length === 1) {
    return tk === kw;
  }
  
  // For multi-word keywords, check if all words appear in token
  // or if the full phrase appears as substring
  const allWordsMatch = keywordWords.every(word => tk.includes(word));
  if (allWordsMatch) return true;
  
  // Also check if the full keyword phrase appears in token
  return tk.includes(kw);
}

/**
 * Execute sprite trigger - applies the sprite to the store
 */
export function executeSpriteTrigger(
  match: TriggerMatch,
  context: TriggerContext,
  storeActions: {
    applyTriggerForCharacter: (characterId: string, hit: {
      spriteUrl: string;
      spriteLabel: string | null;
      returnToIdleMs?: number;
    }) => void;
    scheduleReturnToIdleForCharacter: (
      characterId: string,
      triggerSpriteUrl: string,
      returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
      returnSpriteUrl: string,
      returnSpriteLabel: string | null,
      returnToIdleMs: number
    ) => void;
  },
  getIdleSpriteUrl: () => string | null
): void {
  const { spriteUrl, spriteLabel, returnToIdleMs, characterId } = match.data as {
    spriteUrl: string;
    spriteLabel: string | null;
    returnToIdleMs: number;
    characterId: string;
  };
  
  if (!characterId || !spriteUrl) return;
  
  // Apply the trigger sprite
  storeActions.applyTriggerForCharacter(characterId, {
    spriteUrl,
    spriteLabel,
    returnToIdleMs,
  });
  
  // Schedule return to idle if configured
  // Use 'clear' mode to let normal logic determine what sprite to show
  if (returnToIdleMs > 0) {
    const idleUrl = getIdleSpriteUrl();
    if (idleUrl) {
      storeActions.scheduleReturnToIdleForCharacter(
        characterId,
        spriteUrl,
        'clear',  // Let normal logic determine what to show (talk/thinking/idle)
        idleUrl,
        spriteLabel,
        returnToIdleMs
      );
    }
  }
}

/**
 * Reset state for new message
 */
export function resetSpriteHandlerState(state: SpriteHandlerState, messageKey: string): void {
  state.triggeredPositions.delete(messageKey);
  state.lastPackMatches.delete(messageKey);
}

/**
 * Clear all sprite handler state
 */
export function clearSpriteHandlerState(state: SpriteHandlerState): void {
  state.triggeredPositions.clear();
  state.lastPackMatches.clear();
}
