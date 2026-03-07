'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';

// Debounce time for auto-save (in milliseconds)
const DEBOUNCE_TIME = 2000;

// Data types that should be persisted to files
const PERSIST_KEYS = [
  // Core data
  'characters', 'sessions', 'groups', 'personas', 'settings', 'lorebooks',
  // LLM & TTS
  'llmConfigs', 'ttsConfigs', 'promptTemplates',
  // Sound system
  'soundTriggers', 'soundCollections', 'soundSequenceTriggers',
  // Visual systems
  'backgrounds', 'backgroundPacks', 'spritePacks', 'hudTemplates',
  // Advanced systems
  'activeAtmospherePresetId', 'atmosphereSettings',
  'summaries', 'summarySettings', 'characterMemories', 'sessionTracking',
  'quests', 'questSettings', 'questNotifications',
  'dialogueSettings',
  'items', 'containers', 'currencies', 'inventorySettings', 'inventoryNotifications',
  // Active states
  'activeSessionId', 'activeCharacterId', 'activeGroupId',
  'activeBackground', 'activeOverlayBack', 'activeOverlayFront',
  'activePersonaId', 'activeLorebookIds',
  // Sprite data
  'spriteIndex', 'spriteLibraries',
] as const;

type PersistKey = typeof PERSIST_KEYS[number];

/**
 * Hook to synchronize store data with server-side JSON files
 * - Loads data from server on mount
 * - Auto-saves data to server when store changes (with debounce)
 */
export function usePersistenceSync() {
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSaving = useRef(false);

  // Get store state and actions
  const store = useTavernStore();

  // Load data from server
  const loadFromServer = useCallback(async () => {
    try {
      const response = await fetch('/api/persistence');
      if (!response.ok) {
        console.error('Failed to load persistent data');
        return false;
      }

      const { data } = await response.json();

      // Use store.setState to update all data at once
      if (data) {
        const updates: Record<string, unknown> = {};

        // Core data
        if (data.characters && Array.isArray(data.characters)) {
          updates.characters = data.characters;
        }
        if (data.sessions && Array.isArray(data.sessions)) {
          updates.sessions = data.sessions;
        }
        if (data.groups && Array.isArray(data.groups)) {
          updates.groups = data.groups;
        }
        if (data.personas && Array.isArray(data.personas)) {
          updates.personas = data.personas;
        }
        if (data.settings) {
          updates.settings = data.settings;
        }
        if (data.lorebooks && Array.isArray(data.lorebooks)) {
          updates.lorebooks = data.lorebooks;
        }

        // LLM & TTS
        if (data.llmConfigs && Array.isArray(data.llmConfigs)) {
          updates.llmConfigs = data.llmConfigs;
        }
        if (data.ttsConfigs && Array.isArray(data.ttsConfigs)) {
          updates.ttsConfigs = data.ttsConfigs;
        }
        if (data.promptTemplates && Array.isArray(data.promptTemplates)) {
          updates.promptTemplates = data.promptTemplates;
        }

        // Sound system
        if (data.soundTriggers && Array.isArray(data.soundTriggers)) {
          updates.soundTriggers = data.soundTriggers;
        }
        if (data.soundCollections && Array.isArray(data.soundCollections)) {
          updates.soundCollections = data.soundCollections;
        }
        if (data.soundSequenceTriggers && Array.isArray(data.soundSequenceTriggers)) {
          updates.soundSequenceTriggers = data.soundSequenceTriggers;
        }

        // Visual systems
        if (data.backgrounds && Array.isArray(data.backgrounds)) {
          updates.backgrounds = data.backgrounds;
        }
        if (data.backgroundPacks && Array.isArray(data.backgroundPacks)) {
          updates.backgroundPacks = data.backgroundPacks;
        }
        if (data.spritePacks && Array.isArray(data.spritePacks)) {
          updates.spritePacks = data.spritePacks;
        }
        if (data.sprites) {
          if (data.sprites.spriteIndex) {
            updates.spriteIndex = data.sprites.spriteIndex;
          }
          if (data.sprites.spriteLibraries) {
            updates.spriteLibraries = data.sprites.spriteLibraries;
          }
        }
        if (data.hudTemplates && Array.isArray(data.hudTemplates)) {
          updates.hudTemplates = data.hudTemplates;
        }

        // Advanced systems
        if (data.atmosphere) {
          if (data.atmosphere.activeAtmospherePresetId !== undefined) {
            updates.activeAtmospherePresetId = data.atmosphere.activeAtmospherePresetId;
          }
          if (data.atmosphere.atmosphereSettings) {
            updates.atmosphereSettings = data.atmosphere.atmosphereSettings;
          }
        }
        if (data.memory) {
          if (data.memory.summaries) {
            updates.summaries = data.memory.summaries;
          }
          if (data.memory.summarySettings) {
            updates.summarySettings = data.memory.summarySettings;
          }
          if (data.memory.characterMemories) {
            updates.characterMemories = data.memory.characterMemories;
          }
          if (data.memory.sessionTracking) {
            updates.sessionTracking = data.memory.sessionTracking;
          }
        }
        if (data.quests) {
          if (data.quests.quests) {
            updates.quests = data.quests.quests;
          }
          if (data.quests.questSettings) {
            updates.questSettings = data.quests.questSettings;
          }
          if (data.quests.questNotifications) {
            updates.questNotifications = data.quests.questNotifications;
          }
        }
        if (data.dialogue) {
          if (data.dialogue.dialogueSettings) {
            updates.dialogueSettings = data.dialogue.dialogueSettings;
          }
        }
        if (data.inventory) {
          if (data.inventory.items) {
            updates.items = data.inventory.items;
          }
          if (data.inventory.containers) {
            updates.containers = data.inventory.containers;
          }
          if (data.inventory.currencies) {
            updates.currencies = data.inventory.currencies;
          }
          if (data.inventory.inventorySettings) {
            updates.inventorySettings = data.inventory.inventorySettings;
          }
          if (data.inventory.inventoryNotifications) {
            updates.inventoryNotifications = data.inventory.inventoryNotifications;
          }
        }

        // Active states
        if (data.activeStates) {
          if (data.activeStates.activeSessionId !== undefined) {
            updates.activeSessionId = data.activeStates.activeSessionId;
          }
          if (data.activeStates.activeCharacterId !== undefined) {
            updates.activeCharacterId = data.activeStates.activeCharacterId;
          }
          if (data.activeStates.activeGroupId !== undefined) {
            updates.activeGroupId = data.activeStates.activeGroupId;
          }
          if (data.activeStates.activeBackground !== undefined) {
            updates.activeBackground = data.activeStates.activeBackground;
          }
          if (data.activeStates.activeOverlayBack !== undefined) {
            updates.activeOverlayBack = data.activeStates.activeOverlayBack;
          }
          if (data.activeStates.activeOverlayFront !== undefined) {
            updates.activeOverlayFront = data.activeStates.activeOverlayFront;
          }
          if (data.activeStates.activePersonaId !== undefined) {
            updates.activePersonaId = data.activeStates.activePersonaId;
          }
          if (data.activeStates.activeLorebookIds !== undefined) {
            updates.activeLorebookIds = data.activeStates.activeLorebookIds;
          }
        }

        // Apply updates to store
        if (Object.keys(updates).length > 0) {
          useTavernStore.setState(updates);
        }
      }

      // Load quest templates from separate API (they are stored in individual JSON files)
      // This must be done AFTER the main persistence data is loaded so that
      // character.questTemplateIds and group.questTemplateIds are available
      try {
        const templatesResponse = await fetch('/api/quest-templates');
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          if (templatesData.templates && Array.isArray(templatesData.templates)) {
            useTavernStore.setState({ questTemplates: templatesData.templates });
            console.log('[Persistence] Loaded', templatesData.templates.length, 'quest templates');
          }
        }
      } catch (templateError) {
        console.error('[Persistence] Error loading quest templates:', templateError);
      }

      return true;
    } catch (error) {
      console.error('Error loading persistent data:', error);
      return false;
    }
  }, []);

  // Save data to server
  const saveToServer = useCallback(async () => {
    if (isSaving.current) return;

    try {
      isSaving.current = true;

      const state = useTavernStore.getState();

      const dataToSave: Record<string, unknown> = {
        // Core data
        characters: state.characters,
        sessions: state.sessions,
        groups: state.groups,
        personas: state.personas,
        settings: state.settings,
        lorebooks: state.lorebooks,
        // LLM & TTS
        llmConfigs: state.llmConfigs,
        ttsConfigs: state.ttsConfigs,
        promptTemplates: state.promptTemplates,
        // Sound system
        soundTriggers: state.soundTriggers,
        soundCollections: state.soundCollections,
        soundSequenceTriggers: state.soundSequenceTriggers,
        // Visual systems
        backgrounds: state.backgrounds,
        backgroundPacks: state.backgroundPacks,
        spritePacks: state.spritePacks,
        sprites: {
          spriteIndex: state.spriteIndex,
          spriteLibraries: state.spriteLibraries,
        },
        hudTemplates: state.hudTemplates,
        // Advanced systems
        atmosphere: {
          activeAtmospherePresetId: state.activeAtmospherePresetId,
          atmosphereSettings: state.atmosphereSettings,
        },
        memory: {
          summaries: state.summaries,
          summarySettings: state.summarySettings,
          characterMemories: state.characterMemories,
          sessionTracking: state.sessionTracking,
        },
        quests: {
          quests: state.quests,
          questSettings: state.questSettings,
          questNotifications: state.questNotifications,
        },
        dialogue: {
          dialogueSettings: state.dialogueSettings,
        },
        inventory: {
          items: state.items,
          containers: state.containers,
          currencies: state.currencies,
          inventorySettings: state.inventorySettings,
          inventoryNotifications: state.inventoryNotifications,
        },
        // Active states
        activeStates: {
          activeSessionId: state.activeSessionId,
          activeCharacterId: state.activeCharacterId,
          activeGroupId: state.activeGroupId,
          activeBackground: state.activeBackground,
          activeOverlayBack: state.activeOverlayBack,
          activeOverlayFront: state.activeOverlayFront,
          activePersonaId: state.activePersonaId,
          activeLorebookIds: state.activeLorebookIds,
        },
      };

      const response = await fetch('/api/persistence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        console.error('Failed to save persistent data');
      }
    } catch (error) {
      console.error('Error saving persistent data:', error);
    } finally {
      isSaving.current = false;
    }
  }, []);

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToServer();
    }, DEBOUNCE_TIME);
  }, [saveToServer]);

  // Initialize: load data from server on first mount
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadFromServer();
    }
  }, [loadFromServer]);

  // Subscribe to store changes and auto-save
  useEffect(() => {
    const unsubscribe = useTavernStore.subscribe((state, prevState) => {
      // Check if any persistent data has changed
      const hasChanges = PERSIST_KEYS.some(key => {
        return JSON.stringify(state[key as PersistKey]) !== JSON.stringify(prevState[key as PersistKey]);
      });

      if (hasChanges) {
        debouncedSave();
      }
    });

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedSave]);

  // Manual save function
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveToServer();
  }, [saveToServer]);

  // Manual reload function
  const forceReload = useCallback(async () => {
    return await loadFromServer();
  }, [loadFromServer]);

  return {
    forceSave,
    forceReload,
    isLoading: !isInitialized.current,
  };
}

export default usePersistenceSync;
