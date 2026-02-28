// ============================================
// Character Slice - Character management state
// ============================================

import type { CharacterCard } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface CharacterSlice {
  // State
  characters: CharacterCard[];
  activeCharacterId: string | null;

  // Actions
  addCharacter: (character: Omit<CharacterCard, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCharacter: (id: string, updates: Partial<CharacterCard>) => void;
  deleteCharacter: (id: string) => void;
  setActiveCharacter: (id: string | null) => void;

  // Utilities
  getActiveCharacter: () => CharacterCard | undefined;
  getCharacterById: (id: string) => CharacterCard | undefined;
}

export const createCharacterSlice = (set: any, get: any): CharacterSlice => ({
  // Initial State
  characters: [],
  activeCharacterId: null,

  // Actions
  addCharacter: (character) => set((state: any) => ({
    characters: [...state.characters, {
      ...character,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updateCharacter: (id, updates) => set((state: any) => ({
    characters: state.characters.map((c: CharacterCard) =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    )
  })),

  deleteCharacter: (id) => set((state: any) => ({
    characters: state.characters.filter((c: CharacterCard) => c.id !== id),
    sessions: state.sessions.filter((s: any) => s.characterId !== id),
    activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId
  })),

  setActiveCharacter: (id) => set({ activeCharacterId: id }),

  // Utilities
  getActiveCharacter: () => {
    const state = get();
    return state.characters.find((c: CharacterCard) => c.id === state.activeCharacterId);
  },

  getCharacterById: (id) => get().characters.find((c: CharacterCard) => c.id === id),
});
