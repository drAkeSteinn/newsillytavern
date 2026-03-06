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
  clearSoundHandlerState,
  type SoundHandlerState,
  type SoundTriggerContext,
} from './handlers/sound-handler';
import {
  createSpriteHandlerState,
  checkSpriteTriggers,
  executeSpriteTrigger,
  resetSpriteHandlerState,
  clearSpriteHandlerState,
  checkTriggerCollections,
  executeTriggerCollectionResult,
  markCollectionTriggered,
  type SpriteHandlerState,
  type SpriteTriggerContext,
  type SpriteTriggerContextV2,
  type TriggerCollectionMatchResult,
} from './handlers/sprite-handler';
import {
  createHUDHandlerState,
  checkHUDTriggers,
  executeHUDTrigger,
  resetHUDHandlerState,
  clearHUDHandlerState,
  type HUDHandlerState,
  type HUDTriggerContext,
} from './handlers/hud-handler';
import {
  createBackgroundHandlerState,
  checkBackgroundTriggers,
  checkReturnToDefault,
  executeBackgroundTrigger,
  resetBackgroundHandlerState,
  clearBackgroundHandlerState,
  type BackgroundHandlerState,
  type BackgroundTriggerContext,
} from './handlers/background-handler';
import {
  createQuestHandlerState,
  checkQuestTriggers,
  resetQuestHandlerState,
  clearQuestHandlerState,
  type QuestHandlerState,
  type QuestTriggerContext,
} from './handlers/quest-handler';
import {
  executeQuestCompletionRewards,
  executeObjectiveRewards,
  type RewardStoreActions,
} from '@/lib/quest/quest-reward-executor';
import {
  createItemHandlerState,
  checkItemTriggers,
  resetItemHandlerState,
  clearItemHandlerState,
  type ItemHandlerState,
  type ItemTriggerContext,
} from './handlers/item-handler';
import {
  createStatsHandlerState,
  checkStatsTriggersInText,
  executeStatsTrigger,
  resetStatsHandlerState,
  clearStatsHandlerState,
  type StatsHandlerState,
  type StatsTriggerContext,
} from './handlers/stats-handler';
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
  statsEnabled?: boolean;
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
  
  // Clear ALL state - call this when chat is reset
  clearAllState: () => void;
  
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
  const statsHandlerState = useMemo(() => createStatsHandlerState(), []);
  
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
      statsHandlerState.detectionStates.clear();
      statsHandlerState.processedMessages.clear();
    };
  }, [config.debug, config.tokenDetector, soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState]);
  
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
    // Priority: V2 Trigger Collections > Legacy Sprite Packs > Simple Triggers
    if (config.spriteEnabled !== false) {
      // Get idle sprite URL helper (used by both V2 and legacy)
      const getIdleSpriteUrl = (): string | null => {
        if (!character) return null;
        
        // Try V2 state collections first
        const idleCollectionV2 = character.stateCollectionsV2?.find(c => c.state === 'idle');
        if (idleCollectionV2) {
          const pack = character.spritePacksV2?.find(p => p.id === idleCollectionV2.packId);
          if (pack && idleCollectionV2.principalSpriteId) {
            const sprite = pack.sprites.find(s => s.id === idleCollectionV2.principalSpriteId);
            if (sprite) return sprite.url;
          }
          if (pack && pack.sprites.length > 0) {
            return pack.sprites[0].url;
          }
        }
        
        // Fall back to legacy state collections
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
      
      // Try V2 Trigger Collections first (highest priority)
      const hasV2Data = (character?.triggerCollections && character.triggerCollections.length > 0) ||
                        (character?.spritePacksV2 && character.spritePacksV2.length > 0);
      
      if (hasV2Data) {
        const v2Context: SpriteTriggerContextV2 = {
          ...context,
          triggerCollections: character?.triggerCollections ?? [],
          spritePacksV2: character?.spritePacksV2 ?? store.spritePacksV2 ?? [],
          spriteIndex: store.spriteIndex,
          character: character,
          isSpriteLocked: store.isSpriteLocked(),
        };
        
        const v2Results = checkTriggerCollections(
          newTokens,
          v2Context,
          spriteHandlerState
        );
        
        // Process ALL matched triggers
        if (v2Results.length > 0) {
          console.log('[TriggerSystem] V2 triggers matched:', v2Results.length, v2Results.map(r => ({
            collectionId: r.collection.id,
            collectionName: r.collection.name,
            spriteUrl: r.selectedSprite.url,
            spriteLabel: r.selectedSprite.label,
            matchSource: r.matchSource,
          })));
          
          // Process each result
          for (let i = 0; i < v2Results.length; i++) {
            const v2Result = v2Results[i];
            
            // Mark collection as triggered for cooldown
            markCollectionTriggered(v2Result.collection.id, spriteHandlerState);
            
            if (i === 0) {
              // First trigger - apply immediately
              console.log('[TriggerSystem] Applying first trigger immediately:', v2Result.selectedSprite.label);
              executeTriggerCollectionResult(v2Result, v2Context, {
                applyTriggerForCharacter: store.applyTriggerForCharacter.bind(store),
                scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter.bind(store),
                addTriggerToQueue: store.addTriggerToQueue.bind(store),
                startSpriteChain: store.startSpriteChain.bind(store),
                startSoundChain: store.startSoundChain.bind(store),
              }, getIdleSpriteUrl);
            } else {
              // Subsequent triggers - add to queue
              console.log('[TriggerSystem] Adding trigger to queue:', v2Result.selectedSprite.label);
              
              // Resolve fallback sprite URL based on mode
              const fallbackMode = v2Result.spriteConfig?.fallbackMode ?? v2Result.collection.fallbackMode;
              const fallbackSpriteId = v2Result.spriteConfig?.fallbackSpriteId ?? v2Result.collection.fallbackSpriteId;
              let fallbackSpriteUrl: string | undefined;
              
              if (fallbackMode === 'custom_sprite' && fallbackSpriteId) {
                const fallbackSprite = v2Result.spritePack.sprites.find(s => s.id === fallbackSpriteId);
                if (fallbackSprite) {
                  fallbackSpriteUrl = fallbackSprite.url;
                }
              } else if (fallbackMode === 'idle_collection') {
                fallbackSpriteUrl = getIdleSpriteUrl() ?? undefined;
              } else if (fallbackMode === 'collection_default') {
                // Use collection's principal sprite or first sprite
                const principalSprite = v2Result.spritePack.sprites.find(
                  s => s.id === v2Result.collection.principalSpriteId
                ) ?? v2Result.spritePack.sprites[0];
                if (principalSprite) {
                  fallbackSpriteUrl = principalSprite.url;
                } else {
                  fallbackSpriteUrl = getIdleSpriteUrl() ?? undefined;
                }
              }
              
              store.addTriggerToQueue(character!.id, {
                triggerCollectionId: v2Result.collection.id,
                spriteId: v2Result.selectedSprite.id,
                spriteUrl: v2Result.selectedSprite.url,
                spriteLabel: v2Result.selectedSprite.label,
                source: v2Result.matchSource,
                fallbackMode,
                fallbackDelayMs: v2Result.spriteConfig?.fallbackDelayMs ?? v2Result.collection.fallbackDelayMs,
                fallbackSpriteId,
                fallbackSpriteUrl,
              });
            }
          }
          
          // V2 matched, don't check legacy
          return;
        }
      }
      
      // Fall back to legacy sprite system
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
    
    // Process Quest triggers (New Template/Instance System)
    if (config.questEnabled !== false && store.questSettings?.enabled) {
      const activeSession = store.getActiveSession?.();
      const sessionId = store.activeSessionId || '';
      
      // Get templates and session quest instances
      const templates = store.questTemplates || [];
      const sessionQuests = activeSession?.sessionQuests || [];
      const turnCount = activeSession?.turnCount || 0;
      
      // Only process if we have quests in this session
      if (templates.length > 0 || sessionQuests.length > 0) {
        const questContext: QuestTriggerContext = {
          ...context,
          templates,
          sessionQuests,
          questSettings: store.questSettings,
          sessionId,
          turnCount,
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
              case 'activate':
                // Activate a quest in the session
                store.activateQuest(sessionId, hit.questId);
                break;
                
              case 'progress':
                // Progress an objective
                if (hit.questId && hit.objectiveId) {
                  // Check quest status BEFORE progressing (to detect auto-completion)
                  const questBefore = activeSession?.sessionQuests?.find(
                    (q: { templateId: string; status: string }) => q.templateId === hit.questId
                  );
                  const wasActive = questBefore?.status === 'active';
                  
                  store.progressQuestObjective(
                    sessionId,
                    hit.questId,
                    hit.objectiveId,
                    hit.progress || 1,
                    character?.id
                  );
                  
                  // Execute objective rewards if this progress completes the objective
                  if (hit.completesObjective && hit.objectiveRewards && hit.objectiveRewards.length > 0) {
                    console.log(`[TriggerSystem] Objective completed! Executing ${hit.objectiveRewards.length} rewards`);
                    
                    const objectiveRewardContext = {
                      sessionId,
                      characterId: character?.id || '',
                      character,
                      allCharacters: characters, // Para targetMode en group chats
                      sessionStats: activeSession?.sessionStats,
                      timestamp: Date.now(),
                      // Pass resources for trigger lookup
                      soundCollections: store.soundCollections,
                      soundTriggers: store.soundTriggers,
                      backgroundPacks: store.backgroundTriggerPacks,
                      soundSettings: {
                        enabled: settings.sound?.enabled ?? false,
                        globalVolume: settings.sound?.globalVolume ?? 0.85,
                      },
                      backgroundSettings: {
                        transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                        defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                      },
                    };
                    
                    const rewardActions: RewardStoreActions = {
                      updateCharacterStat: store.updateCharacterStat.bind(store),
                      applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                      scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                      isSpriteLocked: store.isSpriteLocked?.bind(store),
                      playSound: store.playSound?.bind(store),
                      setBackground: store.setBackground?.bind(store),
                      setActiveOverlays: store.setActiveOverlays?.bind(store),
                    };
                    
                    const objectiveRewardResult = executeObjectiveRewards(
                      hit.objectiveRewards,
                      objectiveRewardContext,
                      rewardActions
                    );
                    
                    console.log(
                      `[TriggerSystem] Objective "${hit.objective?.description}" rewards: ${objectiveRewardResult.successCount} succeeded, ${objectiveRewardResult.failureCount} failed`
                    );
                    
                    // Add notification for objective rewards
                    if (objectiveRewardResult.successCount > 0 && store.questSettings.showNotifications) {
                      const rewardMessages = objectiveRewardResult.results
                        .filter(r => r.success)
                        .map(r => r.message)
                        .filter(Boolean);
                      
                      if (rewardMessages.length > 0) {
                        store.addQuestNotification({
                          questId: hit.questId,
                          questName: hit.template?.name || 'Quest',
                          type: 'objective_complete',
                          message: `Objective "${hit.objective?.description}" completed! Rewards: ${rewardMessages.join(', ')}`,
                          rewards: hit.objectiveRewards,
                        });
                      }
                    }
                  }
                  
                  // Check if quest was auto-completed (was active before, now completed)
                  // Get the updated session to check quest status
                  const updatedSession = store.getActiveSession?.();
                  const questAfter = updatedSession?.sessionQuests?.find(
                    (q: { templateId: string; status: string }) => q.templateId === hit.questId
                  );
                  const isNowCompleted = questAfter?.status === 'completed';
                  
                  if (wasActive && isNowCompleted && hit.template?.rewards && hit.template.rewards.length > 0) {
                    console.log(`[TriggerSystem] Quest auto-completed! Executing ${hit.template.rewards.length} quest rewards`);
                    
                    const questRewardContext = {
                      sessionId,
                      characterId: character?.id || '',
                      character,
                      allCharacters: characters, // Para targetMode en group chats
                      sessionStats: updatedSession?.sessionStats,
                      timestamp: Date.now(),
                      // Pass resources for trigger lookup
                      soundCollections: store.soundCollections,
                      soundTriggers: store.soundTriggers,
                      backgroundPacks: store.backgroundTriggerPacks,
                      soundSettings: {
                        enabled: settings.sound?.enabled ?? false,
                        globalVolume: settings.sound?.globalVolume ?? 0.85,
                      },
                      backgroundSettings: {
                        transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                        defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                      },
                    };
                    
                    const questRewardActions: RewardStoreActions = {
                      updateCharacterStat: store.updateCharacterStat.bind(store),
                      applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                      scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                      isSpriteLocked: store.isSpriteLocked?.bind(store),
                      playSound: store.playSound?.bind(store),
                      setBackground: store.setBackground?.bind(store),
                      setActiveOverlays: store.setActiveOverlays?.bind(store),
                    };
                    
                    const questRewardResult = executeQuestCompletionRewards(
                      hit.template,
                      questRewardContext,
                      questRewardActions
                    );
                    
                    console.log(
                      `[TriggerSystem] Quest "${hit.template.name}" auto-completion rewards: ${questRewardResult.successCount} succeeded, ${questRewardResult.failureCount} failed`
                    );
                    
                    // Add quest completion notification with rewards
                    if (store.questSettings.showNotifications) {
                      const rewardMessages = questRewardResult.results
                        .filter(r => r.success)
                        .map(r => r.message)
                        .filter(Boolean);
                      
                      store.addQuestNotification({
                        questId: hit.questId,
                        questName: hit.template.name,
                        type: 'quest_complete',
                        message: `¡Misión completada: ${hit.template.name}!${rewardMessages.length > 0 ? ` Recompensas: ${rewardMessages.join(', ')}` : ''}`,
                        rewards: hit.template.rewards,
                      });
                    }
                  }
                }
                break;
                
              case 'complete':
                if (hit.questId) {
                  // Complete the quest
                  store.completeQuest(sessionId, hit.questId, character?.id);
                  
                  // Execute rewards if template has them
                  if (hit.template?.rewards && hit.template.rewards.length > 0) {
                    const rewardContext = {
                      sessionId,
                      characterId: character?.id || '',
                      character,
                      allCharacters: characters, // Para targetMode en group chats
                      sessionStats: activeSession?.sessionStats,
                      timestamp: Date.now(),
                      // Pass resources for trigger lookup
                      soundCollections: store.soundCollections,
                      soundTriggers: store.soundTriggers,
                      backgroundPacks: store.backgroundTriggerPacks,
                      soundSettings: {
                        enabled: settings.sound?.enabled ?? false,
                        globalVolume: settings.sound?.globalVolume ?? 0.85,
                      },
                      backgroundSettings: {
                        transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                        defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                      },
                    };
                    
                    const rewardActions: RewardStoreActions = {
                      updateCharacterStat: store.updateCharacterStat.bind(store),
                      applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                      scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                      isSpriteLocked: store.isSpriteLocked?.bind(store),
                      playSound: store.playSound?.bind(store),
                      setBackground: store.setBackground?.bind(store),
                      setActiveOverlays: store.setActiveOverlays?.bind(store),
                    };
                    
                    const rewardResult = executeQuestCompletionRewards(
                      hit.template,
                      rewardContext,
                      rewardActions
                    );
                    
                    console.log(
                      `[TriggerSystem] Quest "${hit.template.name}" rewards: ${rewardResult.successCount} succeeded, ${rewardResult.failureCount} failed`
                    );
                    
                    // Add reward info to notification
                    if (rewardResult.successCount > 0 && store.questSettings.showNotifications) {
                      const rewardMessages = rewardResult.results
                        .filter(r => r.success)
                        .map(r => r.message)
                        .filter(Boolean);
                      
                      if (rewardMessages.length > 0) {
                        store.addQuestNotification({
                          questId: hit.questId,
                          questName: hit.template.name,
                          type: 'reward_claimed',
                          message: `Rewards: ${rewardMessages.join(', ')}`,
                          rewards: hit.template.rewards,
                        });
                      }
                    }
                  }
                }
                break;
                
              case 'fail':
                if (hit.questId) {
                  store.failQuest(sessionId, hit.questId);
                }
                break;
            }
            
            // Add notification for quest events (except complete and progress with rewards which are handled separately)
            // Only add notification if:
            // - action is 'activate' or 'fail'
            // - action is 'progress' but doesn't complete objective (no rewards)
            if (store.questSettings.showNotifications) {
              if (hit.action === 'activate') {
                store.addQuestNotification({
                  questId: hit.questId,
                  questName: hit.template?.name || 'Quest',
                  type: 'quest_activated',
                  message: hit.message,
                });
              } else if (hit.action === 'fail') {
                store.addQuestNotification({
                  questId: hit.questId,
                  questName: hit.template?.name || 'Quest',
                  type: 'quest_failed',
                  message: hit.message,
                });
              } else if (hit.action === 'progress' && !hit.completesObjective) {
                // Only notify for progress that doesn't complete objective
                // Progress that completes objective already notified with rewards above
                store.addQuestNotification({
                  questId: hit.questId,
                  questName: hit.template?.name || 'Quest',
                  type: 'objective_complete',
                  message: hit.message,
                });
              }
            }
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
    
    // Process Stats triggers (Character Attributes)
    // IMPORTANT: Only process stats for the SPEAKING character (the one in `character` parameter)
    // This prevents conflicts when multiple characters have the same attribute key
    if (config.statsEnabled !== false) {
      const activeSession = store.getActiveSession?.();
      const sessionId = store.activeSessionId || '';

      // Only process stats for the speaking character
      // In group chats, `character` is the current speaker, not all characters
      if (character?.statsConfig?.enabled) {
        const statsContext: StatsTriggerContext = {
          ...context,
          characterId: character.id,
          statsConfig: character.statsConfig,
          sessionStats: activeSession?.sessionStats,
        };

        const statsResult = checkStatsTriggersInText(
          content,
          statsContext,
          statsHandlerState
        );

        if (statsResult.matched && statsResult.trigger) {
          const hits = executeStatsTrigger(statsResult.trigger, context, {
            updateCharacterStat: store.updateCharacterStat.bind(store),
            activeSessionId: sessionId,
          });

          if (hits.length > 0) {
            console.log(`[TriggerSystem] Stats updated for ${character.name} (${character.id}): ${hits.map(h => `${h.attributeName}=${h.newValue}`).join(', ')}`);
          }
        }
      }
    }
  }, [config, settings, store, soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState, getActiveHUDTemplate]);
  
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
    
    // Get sessionId for quest handler reset
    const sessionId = store.activeSessionId || undefined;
    
    // Reset handlers
    resetSoundHandlerState(soundHandlerState, messageKey);
    resetSpriteHandlerState(spriteHandlerState, messageKey);
    resetHUDHandlerState(hudHandlerState, messageKey);
    resetBackgroundHandlerState(backgroundHandlerState, messageKey);
    resetQuestHandlerState(questHandlerState, messageKey, sessionId);
    resetItemHandlerState(itemHandlerState, messageKey);
    resetStatsHandlerState(statsHandlerState, character?.id || '', messageKey);
    
    // Clear last processed
    lastProcessedRef.current.delete(messageKey);
    
    // Emit message end event
    bus.emit(createMessageEndEvent(messageKey, character, ''));
  }, [soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState, store.activeSessionId]);
  
  /**
   * Clear ALL trigger state - call this when chat is reset
   * This clears all detection states so quests can be re-activated
   */
  const clearAllState = useCallback(() => {
    // Clear all handler states
    clearSoundHandlerState(soundHandlerState);
    clearSpriteHandlerState(spriteHandlerState);
    clearHUDHandlerState(hudHandlerState);
    clearBackgroundHandlerState(backgroundHandlerState);
    clearQuestHandlerState(questHandlerState);
    clearItemHandlerState(itemHandlerState);
    clearStatsHandlerState(statsHandlerState);
    
    // Clear processed tracking
    lastProcessedRef.current.clear();
    
    console.log('[TriggerSystem] All state cleared');
  }, [soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState]);
  
  return {
    processStreamingContent,
    processFullContent,
    resetForNewMessage,
    clearAllState,
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
