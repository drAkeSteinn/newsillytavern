// ============================================
// Use Trigger System - Unified Trigger Hook
// ============================================
//
// This hook integrates all trigger components:
// - Token Detector (unified tokenization)
// - Trigger Bus (event system)
// - Handlers (Sound, Sprite, HUD, Background)
//
// Usage:
// ```tsx
// const { processStreamingContent, resetForNewMessage } = useTriggerSystem();
// 
// // During streaming
// processStreamingContent(accumulatedContent, character, messageKey);
// 
// // When message ends
// resetForNewMessage(messageKey, character);
// ```

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useTavernStore } from '@/store';
import type { CharacterCard, HUDTemplate } from '@/types';
import { 
  getTokenDetector, 
  type TokenDetectorConfig 
} from './token-detector';
import { 
  getTriggerBus, 
  type TriggerContext, 
  createMessageEndEvent,
} from './trigger-bus';
import {
  createSoundHandlerState,
  checkSoundTriggers,
  executeAllSoundTriggers,
  resetSoundHandlerState,
  type SoundHandlerState,
  type SoundTriggerContext,
} from './handlers/sound-handler';
import {
  createSpriteHandlerState,
  checkSpriteTriggers,
  executeSpriteTrigger,
  resetSpriteHandlerState,
  type SpriteHandlerState,
  type SpriteTriggerContext,
} from './handlers/sprite-handler';
import {
  createHUDHandlerState,
  checkHUDTriggers,
  executeHUDTrigger,
  resetHUDHandlerState,
  type HUDHandlerState,
  type HUDTriggerContext,
} from './handlers/hud-handler';
import {
  createBackgroundHandlerState,
  checkBackgroundTriggers,
  checkReturnToDefault,
  executeBackgroundTrigger,
  resetBackgroundHandlerState,
  type BackgroundHandlerState,
  type BackgroundTriggerContext,
} from './handlers/background-handler';
import {
  createQuestHandlerState,
  checkQuestTriggers,
  resetQuestHandlerState,
  type QuestHandlerState,
  type QuestTriggerContext,
} from './handlers/quest-handler';
import {
  createItemHandlerState,
  checkItemTriggers,
  resetItemHandlerState,
  type ItemHandlerState,
  type ItemTriggerContext,
} from './handlers/item-handler';
import type { BackgroundOverlay, BackgroundTransitionType } from '@/types';

// ============================================
// Hook Configuration
// ============================================

export interface TriggerSystemConfig {
  tokenDetector?: Partial<TokenDetectorConfig>;
  soundEnabled?: boolean;
  spriteEnabled?: boolean;
  backgroundEnabled?: boolean;
  hudEnabled?: boolean;
  questEnabled?: boolean;
  inventoryEnabled?: boolean;
  debug?: boolean;
  maxSoundsPerMessage?: number;
}

// ============================================
// Hook Return Type
// ============================================

export interface TriggerSystemResult {
  processStreamingContent: (
    content: string, 
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => void;
  
  processFullContent: (
    content: string,
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => void;
  
  resetForNewMessage: (messageKey: string, character: CharacterCard | null) => void;
  
  isEnabled: boolean;
}

// ============================================
// Hook Implementation
// ============================================

export function useTriggerSystem(config: TriggerSystemConfig = {}): TriggerSystemResult {
  const store = useTavernStore();
  const settings = store.settings;
  
  // Handler states (created once)
  const soundHandlerState = useMemo(() => createSoundHandlerState(), []);
  const spriteHandlerState = useMemo(() => createSpriteHandlerState(), []);
  const hudHandlerState = useMemo(() => createHUDHandlerState(), []);
  const backgroundHandlerState = useMemo(() => createBackgroundHandlerState(), []);
  const questHandlerState = useMemo(() => createQuestHandlerState(), []);
  const itemHandlerState = useMemo(() => createItemHandlerState(), []);
  
  // Track last processed content per message
  const lastProcessedRef = useRef<Map<string, string>>(new Map());
  
  // Initialize trigger bus and detector
  useEffect(() => {
    const bus = getTriggerBus();
    const detector = getTokenDetector(config.tokenDetector);
    
    if (config.debug) {
      bus.setDebug(true);
    }
    
    // Cleanup on unmount
    return () => {
      soundHandlerState.triggeredPositions.clear();
      soundHandlerState.soundCountPerMessage.clear();
      spriteHandlerState.triggeredPositions.clear();
      spriteHandlerState.lastPackMatches.clear();
      hudHandlerState.updatedFields.clear();
      backgroundHandlerState.triggeredPositions.clear();
      backgroundHandlerState.lastTriggeredBackground.clear();
      backgroundHandlerState.lastTriggerTime.clear();
      backgroundHandlerState.currentActivePack.clear();
      questHandlerState.processedQuests.clear();
      questHandlerState.triggeredPositions.clear();
      itemHandlerState.processedItems.clear();
      itemHandlerState.triggeredPositions.clear();
    };
  }, [config.debug, config.tokenDetector, soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState]);
  
  // Check for return to default background periodically
  useEffect(() => {
    if (config.backgroundEnabled === false) return;
    
    const checkInterval = setInterval(() => {
      const bgSettings = settings.backgroundTriggers;
      if (!bgSettings?.enabled || !bgSettings?.returnToDefaultEnabled) return;
      
      const context: BackgroundTriggerContext = {
        character: null,
        characters: undefined,
        fullText: '',
        messageKey: 'return-check',
        isStreaming: false,
        timestamp: Date.now(),
        backgroundPacks: store.backgroundTriggerPacks ?? [],
        backgroundCollections: store.backgroundCollections ?? [],
        backgroundSettings: {
          enabled: bgSettings.enabled,
          globalCooldown: bgSettings.globalCooldown ?? 0,
          transitionDuration: bgSettings.transitionDuration ?? 500,
          defaultTransitionType: (bgSettings.defaultTransitionType as BackgroundTransitionType) ?? 'fade',
          returnToDefaultEnabled: bgSettings.returnToDefaultEnabled ?? false,
          returnToDefaultAfter: bgSettings.returnToDefaultAfter ?? 300000,
          defaultBackgroundUrl: bgSettings.defaultBackgroundUrl ?? '',
          globalOverlays: (bgSettings.globalOverlays as BackgroundOverlay[]) ?? [],
        },
        cooldownContextKey: 'default',
      };
      
      const returnResult = checkReturnToDefault(context, backgroundHandlerState);
      
      if (returnResult?.shouldReturn && returnResult.defaultUrl) {
        console.log('[TriggerSystem] Returning to default background');
        store.setBackground(returnResult.defaultUrl);
        if (returnResult.overlays) {
          store.setActiveOverlays(returnResult.overlays);
        }
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(checkInterval);
  }, [settings.backgroundTriggers, store, backgroundHandlerState, config.backgroundEnabled]);
  
  /**
   * Get the active HUD template based on character or group
   */
  const getActiveHUDTemplate = useCallback((): HUDTemplate | null => {
    const hudSessionState = store.hudSessionState;
    
    // If there's an active template in session, use it
    if (hudSessionState.activeTemplateId) {
      return store.hudTemplates.find(t => t.id === hudSessionState.activeTemplateId) || null;
    }
    
    return null;
  }, [store.hudTemplates, store.hudSessionState]);
  
  /**
   * Process streaming content incrementally
   */
  const processStreamingContent = useCallback((
    content: string,
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => {
    // Check if already processed this exact content
    const lastProcessed = lastProcessedRef.current.get(messageKey);
    if (lastProcessed === content) {
      return;
    }
    lastProcessedRef.current.set(messageKey, content);
    
    const detector = getTokenDetector();
    
    // Process incrementally - get only NEW tokens
    const newTokens = detector.processIncremental(content, messageKey);
    
    if (newTokens.length === 0) {
      return;
    }
    
    // Create context
    const context: TriggerContext = {
      character,
      characters,
      fullText: content,
      messageKey,
      isStreaming: true,
      timestamp: Date.now(),
    };
    
    // Process sound triggers
    if (config.soundEnabled !== false && settings.sound?.enabled) {
      const soundContext: SoundTriggerContext = {
        ...context,
        soundTriggers: store.soundTriggers,
        soundCollections: store.soundCollections,
        soundSettings: {
          enabled: settings.sound?.enabled ?? false,
          globalVolume: settings.sound?.globalVolume ?? 0.85,
          globalCooldown: settings.sound?.globalCooldown ?? 0,
        },
        cooldownContextKey: character?.id || 'default',
      };
      
      const soundResult = checkSoundTriggers(
        newTokens, 
        soundContext, 
        soundHandlerState,
        settings.sound?.maxSoundsPerMessage ?? config.maxSoundsPerMessage ?? 10
      );
      
      // Execute ALL matched sound triggers (they queue up automatically)
      if (soundResult?.matched && soundResult.triggers.length > 0) {
        executeAllSoundTriggers(soundResult, context);
      }
    }
    
    // Process sprite triggers
    if (config.spriteEnabled !== false) {
      const spriteContext: SpriteTriggerContext = {
        ...context,
        spritePacks: character?.spritePacks ?? store.spritePacks ?? [],
        spriteTriggers: character?.spriteTriggers ?? [],
        spriteIndex: store.spriteIndex,
        spriteLibraries: store.spriteLibraries,
        isSpriteLocked: store.isSpriteLocked(),
      };
      
      const spriteResult = checkSpriteTriggers(
        newTokens, 
        spriteContext, 
        spriteHandlerState
      );
      
      if (spriteResult?.matched && spriteResult.trigger) {
        // Get idle sprite URL helper
        const getIdleSpriteUrl = (): string | null => {
          if (!character) return null;
          
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
        
        // Execute sprite trigger using the handler function
        executeSpriteTrigger(spriteResult.trigger, context, {
          applyTriggerForCharacter: store.applyTriggerForCharacter.bind(store),
          scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter.bind(store),
        }, getIdleSpriteUrl);
      }
    }
    
    // Process HUD triggers
    if (config.hudEnabled !== false) {
      const activeHUDTemplate = getActiveHUDTemplate();
      
      if (activeHUDTemplate) {
        const hudContext: HUDTriggerContext = {
          ...context,
          activeHUDTemplate,
          currentValues: store.hudSessionState.fieldValues,
        };
        
        const hudResult = checkHUDTriggers(
          newTokens,
          hudContext,
          hudHandlerState
        );
        
        if (hudResult?.matched && hudResult.trigger) {
          executeHUDTrigger(hudResult.trigger, context, {
            updateHUDFieldValue: store.updateHUDFieldValue.bind(store),
          });
        }
      }
    }
    
    // Process Background triggers
    if (config.backgroundEnabled !== false && settings.backgroundTriggers?.enabled) {
      const bgContext: BackgroundTriggerContext = {
        ...context,
        backgroundPacks: store.backgroundTriggerPacks ?? [],
        backgroundCollections: store.backgroundCollections ?? [],
        backgroundSettings: {
          enabled: settings.backgroundTriggers?.enabled ?? false,
          globalCooldown: settings.backgroundTriggers?.globalCooldown ?? 0,
          transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
          defaultTransitionType: (settings.backgroundTriggers?.defaultTransitionType as BackgroundTransitionType) ?? 'fade',
          returnToDefaultEnabled: settings.backgroundTriggers?.returnToDefaultEnabled ?? false,
          returnToDefaultAfter: settings.backgroundTriggers?.returnToDefaultAfter ?? 300000,
          defaultBackgroundUrl: settings.backgroundTriggers?.defaultBackgroundUrl ?? '',
          globalOverlays: (settings.backgroundTriggers?.globalOverlays as BackgroundOverlay[]) ?? [],
        },
        cooldownContextKey: character?.id || 'default',
      };
      
      const bgResult = checkBackgroundTriggers(
        newTokens,
        bgContext,
        backgroundHandlerState
      );
      
      if (bgResult?.matched && bgResult.trigger) {
        executeBackgroundTrigger(bgResult.trigger, context, {
          setBackground: store.setBackground.bind(store),
          setOverlays: store.setActiveOverlays.bind(store),
        });
      }
    }
    
    // Process Quest triggers
    if (config.questEnabled !== false && store.questSettings?.enabled) {
      const questContext: QuestTriggerContext = {
        ...context,
        quests: store.quests,
        questSettings: store.questSettings,
        sessionId: store.activeSessionId || '',
      };
      
      const questResult = checkQuestTriggers(
        newTokens,
        content,
        questContext,
        questHandlerState
      );
      
      if (questResult.hits.length > 0) {
        // Process quest trigger hits
        for (const hit of questResult.hits) {
          console.log(`[TriggerSystem] Quest trigger: ${hit.message}`);
          
          // Handle different quest actions
          switch (hit.action) {
            case 'start':
              if (hit.questTitle) {
                store.startQuest({
                  sessionId: store.activeSessionId || '',
                  title: hit.questTitle,
                  description: hit.description || '',
                  priority: 'side',
                });
              }
              break;
            case 'progress':
              if (hit.questId && hit.objectiveId) {
                store.progressObjective(hit.questId, hit.objectiveId, hit.progress || 1);
              }
              break;
            case 'complete':
              if (hit.questId) {
                store.completeQuest(hit.questId);
              }
              break;
            case 'fail':
              if (hit.questId) {
                store.failQuest(hit.questId);
              }
              break;
          }
          
          // Add notification if enabled
          if (store.questSettings.showNotifications) {
            store.addQuestNotification({
              questId: hit.questId,
              questTitle: hit.quest?.title || 'Quest',
              type: hit.action === 'complete' ? 'completed' : hit.action === 'fail' ? 'failed' : 'objective_complete',
              message: hit.message,
            });
          }
        }
      }
    }
    
    // Process Item triggers
    if (config.inventoryEnabled !== false && store.inventorySettings?.enabled) {
      const defaultContainer = store.containers.find(c => c.isDefault);
      
      const itemContext: ItemTriggerContext = {
        ...context,
        items: store.items,
        inventoryEntries: defaultContainer?.entries || [],
        inventorySettings: store.inventorySettings,
        defaultContainerId: defaultContainer?.id || '',
      };
      
      const itemResult = checkItemTriggers(
        newTokens,
        content,
        itemContext,
        itemHandlerState
      );
      
      if (itemResult.hits.length > 0) {
        // Process item trigger hits
        for (const hit of itemResult.hits) {
          console.log(`[TriggerSystem] Item trigger: ${hit.message}`);
          
          switch (hit.type) {
            case 'add':
              store.addToInventory(hit.itemId, hit.quantity);
              break;
            case 'remove':
              // Find the entry to remove
              const entryToRemove = defaultContainer?.entries.find(e => e.itemId === hit.itemId);
              if (entryToRemove) {
                store.removeFromInventory(entryToRemove.id, hit.quantity);
              }
              break;
            case 'equip':
              const entryToEquip = defaultContainer?.entries.find(e => e.itemId === hit.itemId);
              if (entryToEquip && hit.item?.slot) {
                store.equipItem(entryToEquip.id, hit.item.slot);
              }
              break;
          }
          
          // Add notification if enabled
          if (store.inventorySettings.showNotifications) {
            store.addInventoryNotification({
              type: hit.type,
              itemName: hit.item?.name || 'Item',
              quantity: hit.quantity,
              message: hit.message,
            });
          }
        }
      }
    }
  }, [config, settings, store, soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, getActiveHUDTemplate]);
  
  /**
   * Process full content at once (non-streaming)
   */
  const processFullContent = useCallback((
    content: string,
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => {
    const detector = getTokenDetector();
    
    // Reset and process full content
    detector.reset(messageKey);
    lastProcessedRef.current.set(messageKey, content);
    
    // Process as streaming content (same logic)
    processStreamingContent(content, character, messageKey, characters);
  }, [processStreamingContent]);
  
  /**
   * Reset for new message
   */
  const resetForNewMessage = useCallback((messageKey: string, character: CharacterCard | null) => {
    const detector = getTokenDetector();
    const bus = getTriggerBus();
    
    // Reset detector
    detector.reset(messageKey);
    
    // Reset handlers
    resetSoundHandlerState(soundHandlerState, messageKey);
    resetSpriteHandlerState(spriteHandlerState, messageKey);
    resetHUDHandlerState(hudHandlerState, messageKey);
    resetBackgroundHandlerState(backgroundHandlerState, messageKey);
    resetQuestHandlerState(questHandlerState, messageKey);
    resetItemHandlerState(itemHandlerState, messageKey);
    
    // Clear last processed
    lastProcessedRef.current.delete(messageKey);
    
    // Emit message end event
    bus.emit(createMessageEndEvent(messageKey, character, ''));
  }, [soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState]);
  
  return {
    processStreamingContent,
    processFullContent,
    resetForNewMessage,
    isEnabled: true,
  };
}

// ============================================
// Export Everything
// ============================================

export { getTokenDetector, getTriggerBus };
export * from './token-detector';
export * from './trigger-bus';
export * from './types';
