// ============================================
// Unified Trigger Executor - Execute Triggers as Rewards
// ============================================
//
// Este módulo ejecuta triggers directamente, sin pasar por el TokenDetector.
// Se usa principalmente para ejecutar recompensas de quests.
//
// Flujo:
// 1. Recibe categoría (sprite/sound/background) y key
// 2. Crea un "trigger match" sintético
// 3. Llama directamente a las funciones de ejecución de los handlers
//
// Ventajas:
// - Reutiliza toda la infraestructura existente
// - No duplica lógica de ejecución
// - Soporta targetMode para grupos

import type { CharacterCard } from '@/types';
import type { TriggerContext } from './trigger-bus';
import type { TriggerMatch } from './types';
import {
  executeSoundTrigger,
} from './handlers/sound-handler';
import {
  executeSpriteTrigger,
} from './handlers/sprite-handler';
import {
  executeBackgroundTrigger,
} from './handlers/background-handler';
import type { BackgroundOverlay, BackgroundTransitionType } from '@/types';

// ============================================
// Types
// ============================================

export type TriggerCategory = 'sprite' | 'sound' | 'background';
export type TriggerTargetMode = 'self' | 'all' | 'target';

/**
 * Contexto para ejecución de triggers como recompensa
 */
export interface TriggerExecutionContext {
  sessionId: string;
  characterId: string;              // Quién completó el objetivo/misión
  character: CharacterCard;         // Personaje que recibe el trigger
  allCharacters?: CharacterCard[];  // Para grupos - todos los personajes
  source: 'objective' | 'quest_completion' | 'manual';
  timestamp: number;
  
  // Store access
  storeActions: TriggerStoreActions;
  
  // Settings
  soundSettings?: {
    enabled: boolean;
    globalVolume: number;
  };
  backgroundSettings?: {
    transitionDuration: number;
    defaultTransitionType: BackgroundTransitionType;
  };
}

/**
 * Acciones del store necesarias para ejecutar triggers
 */
export interface TriggerStoreActions {
  // Sprite
  applyTriggerForCharacter: (
    characterId: string,
    spriteUrl: string,
    returnToIdleMs?: number
  ) => void;
  scheduleReturnToIdleForCharacter: (
    characterId: string,
    triggerSpriteUrl: string,
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
    returnToIdleMs: number
  ) => void;
  isSpriteLocked?: () => boolean;
  
  // Sound
  playSound?: (collection: string, filename: string, volume?: number) => void;
  
  // Background
  setBackground?: (url: string) => void;
  setActiveOverlays?: (overlays: BackgroundOverlay[]) => void;
}

/**
 * Resultado de ejecutar un trigger
 */
export interface TriggerExecutionResult {
  success: boolean;
  category: TriggerCategory;
  key: string;
  targetCharacterId: string;
  message?: string;
  error?: string;
}

/**
 * Resultado de ejecutar múltiples triggers
 */
export interface TriggerBatchResult {
  results: TriggerExecutionResult[];
  successCount: number;
  failureCount: number;
}

// ============================================
// Sprite Trigger Execution
// ============================================

/**
 * Ejecuta un trigger de sprite para un personaje
 */
function executeSpriteTriggerForCharacter(
  key: string,
  context: TriggerExecutionContext,
  character: CharacterCard,
  returnToIdleMs: number = 0
): TriggerExecutionResult {
  const { storeActions } = context;
  
  try {
    // Check if sprite is locked
    if (storeActions.isSpriteLocked?.()) {
      return {
        success: false,
        category: 'sprite',
        key,
        targetCharacterId: character.id,
        error: 'Sprite is locked',
      };
    }
    
    // Find matching sprite in character's sprite packs or triggers
    const spriteMatch = findSpriteMatch(key, character);
    
    if (!spriteMatch) {
      console.log(`[UnifiedTriggerExecutor] No sprite found for key "${key}" in character "${character.name}"`);
      return {
        success: false,
        category: 'sprite',
        key,
        targetCharacterId: character.id,
        error: `No sprite found for key "${key}"`,
      };
    }
    
    // Create synthetic trigger match
    const match: TriggerMatch = {
      triggerId: `reward-sprite-${Date.now()}`,
      triggerType: 'sprite',
      keyword: key,
      data: {
        spriteUrl: spriteMatch.url,
        spriteLabel: spriteMatch.label,
        returnToIdleMs,
        characterId: character.id,
      },
    };
    
    // Create trigger context
    const triggerContext: TriggerContext = {
      character,
      fullText: `[REWARD:sprite:${key}]`,
      messageKey: `reward-${Date.now()}`,
      isStreaming: false,
      timestamp: Date.now(),
    };
    
    // Get idle sprite URL helper
    const getIdleSpriteUrl = (): string | null => {
      const idleCollection = character.spriteConfig?.stateCollections?.['idle'];
      if (idleCollection?.entries.length) {
        const entry = idleCollection.entries.find(e => e.role === 'principal') || idleCollection.entries[0];
        if (entry?.spriteUrl) return entry.spriteUrl;
      }
      if (character.spriteConfig?.sprites?.['idle']) {
        return character.spriteConfig.sprites['idle'];
      }
      if (character.avatar) {
        return character.avatar;
      }
      return null;
    };
    
    // Execute sprite trigger
    executeSpriteTrigger(match, triggerContext, {
      applyTriggerForCharacter: storeActions.applyTriggerForCharacter,
      scheduleReturnToIdleForCharacter: storeActions.scheduleReturnToIdleForCharacter,
    }, getIdleSpriteUrl);
    
    return {
      success: true,
      category: 'sprite',
      key,
      targetCharacterId: character.id,
      message: `Sprite "${spriteMatch.label || spriteMatch.url}" applied to ${character.name}`,
    };
  } catch (error) {
    return {
      success: false,
      category: 'sprite',
      key,
      targetCharacterId: character.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Busca un sprite que coincida con la key en el personaje
 */
function findSpriteMatch(
  key: string,
  character: CharacterCard
): { url: string; label?: string } | null {
  // 1. Search in sprite packs
  if (character.spritePacks) {
    for (const pack of character.spritePacks) {
      if (!pack.active) continue;
      
      // Check pack keywords
      const normalizedKey = key.toLowerCase();
      const packMatches = pack.keywords.some(kw => kw.toLowerCase() === normalizedKey);
      
      if (packMatches && pack.items && pack.items.length > 0) {
        // Find an item that matches
        const item = pack.items.find(i => i.enabled !== false);
        if (item?.spriteUrl) {
          return { url: item.spriteUrl, label: item.spriteLabel };
        }
      }
    }
  }
  
  // 2. Search in simple sprite triggers
  if (character.spriteTriggers) {
    const normalizedKey = key.toLowerCase();
    const trigger = character.spriteTriggers.find(t => 
      t.active && t.keywords.some(kw => kw.toLowerCase() === normalizedKey)
    );
    
    if (trigger?.spriteUrl) {
      return { url: trigger.spriteUrl, label: trigger.spriteState };
    }
  }
  
  // 3. Search in sprite config state collections
  if (character.spriteConfig?.stateCollections) {
    const normalizedKey = key.toLowerCase();
    
    // Check if key matches a state name
    for (const [stateName, collection] of Object.entries(character.spriteConfig.stateCollections)) {
      if (stateName.toLowerCase() === normalizedKey && collection.entries.length > 0) {
        const entry = collection.entries.find(e => e.role === 'principal') || collection.entries[0];
        if (entry?.spriteUrl) {
          return { url: entry.spriteUrl, label: entry.spriteLabel };
        }
      }
    }
  }
  
  return null;
}

// ============================================
// Sound Trigger Execution
// ============================================

/**
 * Ejecuta un trigger de sonido
 */
function executeSoundTriggerForCharacter(
  key: string,
  context: TriggerExecutionContext,
  _character: CharacterCard,
  volume: number = 0.8
): TriggerExecutionResult {
  const { storeActions, soundSettings } = context;
  
  try {
    if (!storeActions.playSound) {
      return {
        success: false,
        category: 'sound',
        key,
        targetCharacterId: context.characterId,
        error: 'Sound playback not available',
      };
    }
    
    // For sounds, key can be:
    // - "collection/filename" format
    // - Just a key that we need to look up in triggers
    
    let collection: string;
    let filename: string;
    
    if (key.includes('/')) {
      [collection, filename] = key.split('/');
    } else {
      // Use default collection or interpret key as filename
      collection = 'default';
      filename = key;
    }
    
    const finalVolume = volume * (soundSettings?.globalVolume ?? 1);
    
    // Create synthetic trigger match
    const match: TriggerMatch = {
      triggerId: `reward-sound-${Date.now()}`,
      triggerType: 'sound',
      keyword: key,
      data: {
        soundUrl: `/sounds/${collection}/${filename}`,
        volume: finalVolume,
        triggerName: `Reward: ${key}`,
      },
    };
    
    // Create trigger context
    const triggerContext: TriggerContext = {
      character: context.character,
      fullText: `[REWARD:sound:${key}]`,
      messageKey: `reward-${Date.now()}`,
      isStreaming: false,
      timestamp: Date.now(),
    };
    
    // Execute sound trigger (this adds to audio queue)
    executeSoundTrigger(match, triggerContext);
    
    return {
      success: true,
      category: 'sound',
      key,
      targetCharacterId: context.characterId,
      message: `Sound "${key}" queued for playback`,
    };
  } catch (error) {
    return {
      success: false,
      category: 'sound',
      key,
      targetCharacterId: context.characterId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Background Trigger Execution
// ============================================

/**
 * Ejecuta un trigger de fondo
 */
function executeBackgroundTriggerForCharacter(
  key: string,
  context: TriggerExecutionContext,
  _character: CharacterCard,
  transitionDuration?: number
): TriggerExecutionResult {
  const { storeActions, backgroundSettings } = context;
  
  try {
    if (!storeActions.setBackground) {
      return {
        success: false,
        category: 'background',
        key,
        targetCharacterId: context.characterId,
        error: 'Background change not available',
      };
    }
    
    // For backgrounds, key can be:
    // - A URL directly
    // - A label to look up
    // - A path to the background
    
    let backgroundUrl: string;
    
    if (key.startsWith('http') || key.startsWith('/') || key.startsWith('data:')) {
      // Direct URL
      backgroundUrl = key;
    } else {
      // Assume it's a path in the backgrounds folder
      backgroundUrl = `/backgrounds/${key}`;
    }
    
    // Create synthetic trigger match
    const match: TriggerMatch = {
      triggerId: `reward-background-${Date.now()}`,
      triggerType: 'background',
      keyword: key,
      data: {
        backgroundUrl,
        transitionDuration: transitionDuration ?? backgroundSettings?.transitionDuration ?? 500,
        transitionType: backgroundSettings?.defaultTransitionType ?? 'fade',
        overlays: [],
      },
    };
    
    // Create trigger context
    const triggerContext: TriggerContext = {
      character: context.character,
      fullText: `[REWARD:background:${key}]`,
      messageKey: `reward-${Date.now()}`,
      isStreaming: false,
      timestamp: Date.now(),
    };
    
    // Execute background trigger
    executeBackgroundTrigger(match, triggerContext, {
      setBackground: storeActions.setBackground,
      setOverlays: storeActions.setActiveOverlays,
    });
    
    return {
      success: true,
      category: 'background',
      key,
      targetCharacterId: context.characterId,
      message: `Background changed to "${key}"`,
    };
  } catch (error) {
    return {
      success: false,
      category: 'background',
      key,
      targetCharacterId: context.characterId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Main Execution Functions
// ============================================

/**
 * Ejecuta un trigger de recompensa para un personaje específico
 */
export function executeTriggerForCharacter(
  category: TriggerCategory,
  key: string,
  character: CharacterCard,
  context: TriggerExecutionContext,
  options?: {
    returnToIdleMs?: number;
    volume?: number;
    transitionDuration?: number;
  }
): TriggerExecutionResult {
  switch (category) {
    case 'sprite':
      return executeSpriteTriggerForCharacter(key, context, character, options?.returnToIdleMs ?? 0);
    case 'sound':
      return executeSoundTriggerForCharacter(key, context, character, options?.volume ?? 0.8);
    case 'background':
      return executeBackgroundTriggerForCharacter(key, context, character, options?.transitionDuration);
    default:
      return {
        success: false,
        category: category as TriggerCategory,
        key,
        targetCharacterId: character.id,
        error: `Unknown trigger category: ${category}`,
      };
  }
}

/**
 * Ejecuta un trigger de recompensa con soporte para targetMode
 * 
 * @param category - Categoría del trigger (sprite, sound, background)
 * @param key - Key del trigger
 * @param context - Contexto de ejecución
 * @param targetMode - Quién recibe el trigger
 * @param options - Opciones específicas por categoría
 */
export function executeTriggerReward(
  category: TriggerCategory,
  key: string,
  context: TriggerExecutionContext,
  targetMode: TriggerTargetMode = 'self',
  options?: {
    returnToIdleMs?: number;
    volume?: number;
    transitionDuration?: number;
  }
): TriggerExecutionResult[] {
  // Determine target characters based on targetMode
  const targetCharacters = getTargetCharacters(targetMode, context);
  
  if (targetCharacters.length === 0) {
    return [{
      success: false,
      category,
      key,
      targetCharacterId: context.characterId,
      error: 'No target characters found',
    }];
  }
  
  // Execute trigger for each target
  const results: TriggerExecutionResult[] = [];
  
  for (const targetChar of targetCharacters) {
    const result = executeTriggerForCharacter(category, key, targetChar, context, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Ejecuta múltiples triggers de recompensa
 */
export function executeTriggerRewards(
  triggers: Array<{
    category: TriggerCategory;
    key: string;
    targetMode: TriggerTargetMode;
    returnToIdleMs?: number;
    volume?: number;
    transitionDuration?: number;
  }>,
  context: TriggerExecutionContext
): TriggerBatchResult {
  const results: TriggerExecutionResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const trigger of triggers) {
    const triggerResults = executeTriggerReward(
      trigger.category,
      trigger.key,
      context,
      trigger.targetMode,
      {
        returnToIdleMs: trigger.returnToIdleMs,
        volume: trigger.volume,
        transitionDuration: trigger.transitionDuration,
      }
    );
    
    for (const result of triggerResults) {
      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
  }
  
  return {
    results,
    successCount,
    failureCount,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Determina los personajes objetivo según targetMode
 */
function getTargetCharacters(
  targetMode: TriggerTargetMode,
  context: TriggerExecutionContext
): CharacterCard[] {
  switch (targetMode) {
    case 'self':
      return context.character ? [context.character] : [];
      
    case 'all':
      // For group chats, return all characters
      if (context.allCharacters && context.allCharacters.length > 0) {
        return context.allCharacters;
      }
      // Fallback to self if no group
      return context.character ? [context.character] : [];
      
    case 'target':
      // Specific target - for now, same as self
      // Could be extended with a targetId parameter
      return context.character ? [context.character] : [];
      
    default:
      return context.character ? [context.character] : [];
  }
}

// ============================================
// Export Index
// ============================================

export type {
  TriggerExecutionContext,
  TriggerStoreActions,
  TriggerExecutionResult,
  TriggerBatchResult,
};
