// ============================================
// Dialogue Slice - State management for dialogue display system
// ============================================

import type { StateCreator } from 'zustand';
import {
  DEFAULT_DIALOGUE_SETTINGS,
  type DialogueSettings,
  type CharacterDialogueStyle,
  type TypewriterSettings,
  type DialogueFormatSettings,
} from '@/types';

// Re-export for convenience
export { DEFAULT_DIALOGUE_SETTINGS };

// ============================================
// Slice Type
// ============================================

export interface DialogueSlice {
  // Dialogue State
  dialogueSettings: DialogueSettings;
  
  // Settings Actions
  setDialogueSettings: (settings: Partial<DialogueSettings>) => void;
  resetDialogueSettings: () => void;
  
  // Typewriter Actions
  setTypewriterSettings: (settings: Partial<TypewriterSettings>) => void;
  
  // Formatting Actions
  setFormatSettings: (settings: Partial<DialogueFormatSettings>) => void;
  
  // Character Style Actions
  setCharacterStyle: (style: CharacterDialogueStyle) => void;
  removeCharacterStyle: (characterId: string) => void;
  getCharacterStyle: (characterId: string) => CharacterDialogueStyle | undefined;
}

// ============================================
// Slice Creator
// ============================================

export const createDialogueSlice: StateCreator<DialogueSlice, [], [], DialogueSlice> = (set, get) => ({
  // Initial State
  dialogueSettings: DEFAULT_DIALOGUE_SETTINGS,
  
  // Settings Actions
  setDialogueSettings: (settings) => set((state) => ({
    dialogueSettings: { ...state.dialogueSettings, ...settings }
  })),
  
  resetDialogueSettings: () => set({
    dialogueSettings: DEFAULT_DIALOGUE_SETTINGS
  }),
  
  // Typewriter Actions
  setTypewriterSettings: (settings) => set((state) => ({
    dialogueSettings: {
      ...state.dialogueSettings,
      typewriter: { ...state.dialogueSettings.typewriter, ...settings }
    }
  })),
  
  // Formatting Actions
  setFormatSettings: (settings) => set((state) => ({
    dialogueSettings: {
      ...state.dialogueSettings,
      formatting: { ...state.dialogueSettings.formatting, ...settings }
    }
  })),
  
  // Character Style Actions
  setCharacterStyle: (style) => set((state) => {
    const existing = state.dialogueSettings.characterStyles.findIndex(
      s => s.characterId === style.characterId
    );
    
    const newStyles = [...state.dialogueSettings.characterStyles];
    
    if (existing >= 0) {
      newStyles[existing] = style;
    } else {
      newStyles.push(style);
    }
    
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        characterStyles: newStyles
      }
    };
  }),
  
  removeCharacterStyle: (characterId) => set((state) => ({
    dialogueSettings: {
      ...state.dialogueSettings,
      characterStyles: state.dialogueSettings.characterStyles.filter(
        s => s.characterId !== characterId
      )
    }
  })),
  
  getCharacterStyle: (characterId) => {
    return get().dialogueSettings.characterStyles.find(
      s => s.characterId === characterId
    );
  },
});
