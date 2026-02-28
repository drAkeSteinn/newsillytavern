// ============================================
// Sound Slice - Sound triggers and collections
// ============================================

import type { SoundTrigger, SoundCollection } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface SoundSlice {
  // State
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];

  // Actions
  addSoundTrigger: (trigger: Omit<SoundTrigger, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>) => void;
  updateSoundTrigger: (id: string, updates: Partial<SoundTrigger>) => void;
  deleteSoundTrigger: (id: string) => void;
  cloneSoundTrigger: (id: string) => void;
  toggleSoundTrigger: (id: string) => void;
  toggleSoundKeyword: (triggerId: string, keyword: string) => void;
  setSoundCollections: (collections: SoundCollection[]) => void;
  updateSoundTriggerIndex: (id: string, index: number) => void;
}

export const createSoundSlice = (set: any, _get: any): SoundSlice => ({
  // Initial State
  soundTriggers: [],
  soundCollections: [],

  // Actions
  addSoundTrigger: (trigger) => set((state: any) => {
    const keywordsEnabled: Record<string, boolean> = {};
    trigger.keywords.forEach(kw => {
      keywordsEnabled[kw] = true;
    });
    return {
      soundTriggers: [...state.soundTriggers, {
        ...trigger,
        id: uuidv4(),
        currentIndex: 0,
        keywordsEnabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  updateSoundTrigger: (id, updates) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    )
  })),

  deleteSoundTrigger: (id) => set((state: any) => ({
    soundTriggers: state.soundTriggers.filter((t: SoundTrigger) => t.id !== id)
  })),

  cloneSoundTrigger: (id) => set((state: any) => {
    const trigger = state.soundTriggers.find((t: SoundTrigger) => t.id === id);
    if (!trigger) return state;
    return {
      soundTriggers: [...state.soundTriggers, {
        ...trigger,
        id: uuidv4(),
        name: `${trigger.name} (copy)`,
        currentIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  toggleSoundTrigger: (id) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) =>
      t.id === id ? { ...t, active: !t.active, updatedAt: new Date().toISOString() } : t
    )
  })),

  toggleSoundKeyword: (triggerId, keyword) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) => {
      if (t.id !== triggerId) return t;
      return {
        ...t,
        keywordsEnabled: {
          ...t.keywordsEnabled,
          [keyword]: !t.keywordsEnabled[keyword]
        },
        updatedAt: new Date().toISOString()
      };
    })
  })),

  setSoundCollections: (collections) => set({ soundCollections: collections }),

  updateSoundTriggerIndex: (id, index) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) =>
      t.id === id ? { ...t, currentIndex: index, updatedAt: new Date().toISOString() } : t
    )
  })),
});
