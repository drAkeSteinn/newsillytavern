// ============================================
// TavernFlow Store - Combined store with persistence
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CharacterCard, Persona } from '@/types';

// Import all slices
import {
  createCharacterSlice,
  createSessionSlice,
  createGroupSlice,
  createLLMSlice,
  createSettingsSlice,
  createLorebookSlice,
  createPersonaSlice,
  createBackgroundSlice,
  createSoundSlice,
  createUISlice,
  createSpriteSlice,
  createHUDSlice,
  createAtmosphereSlice,
  createMemorySlice,
} from './slices';

// Import slice types
import type {
  CharacterSlice,
  SessionSlice,
  GroupSlice,
  LLMSlice,
  SettingsSlice,
  LorebookSlice,
  PersonaSlice,
  BackgroundSlice,
  SoundSlice,
  UISlice,
  SpriteSlice,
  HUDSlice,
  AtmosphereSlice,
  MemorySlice,
} from './slices';

// Import defaults for merge function
import { defaultSettings, defaultPersona } from './defaults';

// Combined store type
export type TavernState = CharacterSlice &
  SessionSlice &
  GroupSlice &
  LLMSlice &
  SettingsSlice &
  LorebookSlice &
  PersonaSlice &
  BackgroundSlice &
  SoundSlice &
  UISlice &
  SpriteSlice &
  HUDSlice &
  AtmosphereSlice &
  MemorySlice;

// Create the combined store
export const useTavernStore = create<TavernState>()(
  persist(
    (set, get) => ({
      // Combine all slices
      ...createCharacterSlice(set, get),
      ...createSessionSlice(set, get),
      ...createGroupSlice(set, get),
      ...createLLMSlice(set, get),
      ...createSettingsSlice(set, get),
      ...createLorebookSlice(set, get),
      ...createPersonaSlice(set, get),
      ...createBackgroundSlice(set, get),
      ...createSoundSlice(set, get),
      ...createUISlice(set, get),
      ...createSpriteSlice(set, get),
      ...createHUDSlice(set, get),
      ...createAtmosphereSlice(set, get),
      ...createMemorySlice(set, get),
    }),
    {
      name: 'tavernflow-storage', // Same name for backward compatibility
      partialize: (state) => ({
        // Data to persist
        characters: state.characters,
        sessions: state.sessions,
        groups: state.groups,
        backgrounds: state.backgrounds,
        llmConfigs: state.llmConfigs,
        ttsConfigs: state.ttsConfigs,
        promptTemplates: state.promptTemplates,
        settings: state.settings,
        soundTriggers: state.soundTriggers,
        soundCollections: state.soundCollections,
        personas: state.personas,
        backgroundPacks: state.backgroundPacks,
        backgroundIndex: state.backgroundIndex,
        lorebooks: state.lorebooks,
        activeLorebookIds: state.activeLorebookIds,
        // Sprite data
        spritePacks: state.spritePacks,
        spriteIndex: state.spriteIndex,
        spriteLibraries: state.spriteLibraries,
        // HUD data (templates only, not session state)
        hudTemplates: state.hudTemplates,
        // Active states
        activeSessionId: state.activeSessionId,
        activeCharacterId: state.activeCharacterId,
        activeGroupId: state.activeGroupId,
        activeBackground: state.activeBackground,
        activeOverlayBack: state.activeOverlayBack,
        activeOverlayFront: state.activeOverlayFront,
        activePersonaId: state.activePersonaId,
        // Atmosphere state
        activeAtmospherePresetId: state.activeAtmospherePresetId,
        atmosphereSettings: state.atmosphereSettings,
        // Memory state
        summaries: state.summaries,
        summarySettings: state.summarySettings,
        characterMemories: state.characterMemories,
        sessionTracking: state.sessionTracking,
      }),
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as Record<string, unknown> | undefined;
        if (!persisted) return currentState;

        // Merge settings with defaults to ensure new fields exist
        const persistedSettings = persisted.settings as Record<string, unknown> | undefined;
        const mergedSettings = {
          ...currentState.settings,
          ...(persistedSettings || {}),
          // Ensure sound settings exist with defaults
          sound: {
            ...currentState.settings.sound,
            ...((persistedSettings?.sound as Record<string, unknown>) || {})
          },
          // Ensure backgroundTriggers settings exist with defaults
          backgroundTriggers: {
            ...currentState.settings.backgroundTriggers,
            ...((persistedSettings?.backgroundTriggers as Record<string, unknown>) || {})
          },
          // Ensure chatLayout settings exist with defaults
          chatLayout: {
            ...currentState.settings.chatLayout,
            ...((persistedSettings?.chatLayout as Record<string, unknown>) || {})
          }
        };

        // Ensure characters have the characterNote field
        const persistedCharacters = persisted.characters as CharacterCard[] | undefined;
        const mergedCharacters = (persistedCharacters || currentState.characters).map(char => ({
          ...char,
          characterNote: char.characterNote ?? '' // Add characterNote if missing
        }));

        // Ensure personas exist with default if not present
        const persistedPersonas = persisted.personas as Persona[] | undefined;
        const mergedPersonas = persistedPersonas && persistedPersonas.length > 0
          ? persistedPersonas
          : currentState.personas;

        // Migrate groups to new format with members array
        const persistedGroups = persisted.groups as Array<Record<string, unknown>> | undefined;
        const mergedGroups = (persistedGroups || currentState.groups).map(g => {
          const group = g as any;
          if (!group.members && group.characterIds) {
            return {
              ...group,
              members: group.characterIds.map((id: string, index: number) => ({
                characterId: id,
                role: 'member' as const,
                isActive: true,
                isPresent: true,
                joinOrder: index
              }))
            };
          }
          return group;
        });

        // Migrate messages to have swipes array
        const persistedSessions = persisted.sessions as Array<Record<string, unknown>> | undefined;
        const mergedSessions = (persistedSessions || currentState.sessions).map(session => {
          const s = session as any;
          if (s.messages) {
            return {
              ...s,
              messages: s.messages.map((m: any) => ({
                ...m,
                // Add swipes array if missing (use current content as first swipe)
                swipes: m.swipes?.length ? m.swipes : [m.content || ''],
                // Ensure swipeIndex exists
                swipeIndex: m.swipeIndex ?? 0
              }))
            };
          }
          return s;
        });

        // Return merged state
        return {
          ...currentState,
          ...persisted,
          settings: mergedSettings,
          characters: mergedCharacters,
          personas: mergedPersonas,
          groups: mergedGroups,
          sessions: mergedSessions,
        };
      },
    }
  )
);

// Export types
export type { CharacterSlice, SessionSlice, GroupSlice, LLMSlice, SettingsSlice, LorebookSlice, PersonaSlice, BackgroundSlice, SoundSlice, UISlice, SpriteSlice, HUDSlice, AtmosphereSlice, MemorySlice };
