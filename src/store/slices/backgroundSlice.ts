// ============================================
// Background Slice - Backgrounds and overlays
// ============================================

import type { Background, BackgroundPack, BackgroundIndex, BackgroundTriggerHit } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface BackgroundSlice {
  // State
  backgrounds: Background[];
  backgroundPacks: BackgroundPack[];
  backgroundIndex: BackgroundIndex;
  activeBackground: string;
  activeOverlayBack: string;
  activeOverlayFront: string;

  // Background Actions
  addBackground: (background: Omit<Background, 'id'>) => void;
  setActiveBackground: (url: string) => void;
  setActiveOverlay: (backUrl: string, frontUrl: string) => void;
  applyBackgroundHit: (hit: BackgroundTriggerHit) => void;

  // Background Pack Actions
  addBackgroundPack: (pack: Omit<BackgroundPack, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>) => void;
  updateBackgroundPack: (id: string, updates: Partial<BackgroundPack>) => void;
  deleteBackgroundPack: (id: string) => void;
  cloneBackgroundPack: (id: string) => void;
  toggleBackgroundPack: (id: string) => void;
  setBackgroundIndex: (index: BackgroundIndex) => void;
  updateBackgroundPackIndex: (id: string, index: number) => void;
}

export const createBackgroundSlice = (set: any, get: any): BackgroundSlice => ({
  // Initial State
  backgrounds: [],
  backgroundPacks: [],
  backgroundIndex: { backgrounds: [], lastUpdated: 0, source: '' },
  activeBackground: '',
  activeOverlayBack: '',
  activeOverlayFront: '',

  // Background Actions
  addBackground: (background) => set((state: any) => ({
    backgrounds: [...state.backgrounds, { ...background, id: uuidv4() }]
  })),

  setActiveBackground: (url) => set({ activeBackground: url }),

  setActiveOverlay: (backUrl, frontUrl) => set({
    activeOverlayBack: backUrl,
    activeOverlayFront: frontUrl
  }),

  applyBackgroundHit: (hit) => {
    const updates: Partial<BackgroundSlice> = {
      activeBackground: hit.backgroundUrl || '',
    };

    // Apply overlay based on placement
    if (hit.overlayPlacement === 'back') {
      updates.activeOverlayBack = hit.overlayUrl || '';
      updates.activeOverlayFront = '';
    } else if (hit.overlayPlacement === 'front') {
      updates.activeOverlayBack = '';
      updates.activeOverlayFront = hit.overlayUrl || '';
    } else {
      updates.activeOverlayBack = '';
      updates.activeOverlayFront = '';
    }

    set(updates);
  },

  // Background Pack Actions
  addBackgroundPack: (pack) => set((state: any) => ({
    backgroundPacks: [...state.backgroundPacks, {
      ...pack,
      id: uuidv4(),
      currentIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updateBackgroundPack: (id, updates) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.map((p: BackgroundPack) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    )
  })),

  deleteBackgroundPack: (id) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.filter((p: BackgroundPack) => p.id !== id)
  })),

  cloneBackgroundPack: (id) => set((state: any) => {
    const pack = state.backgroundPacks.find((p: BackgroundPack) => p.id === id);
    if (!pack) return state;
    return {
      backgroundPacks: [...state.backgroundPacks, {
        ...pack,
        id: uuidv4(),
        title: `${pack.title} (copy)`,
        currentIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  toggleBackgroundPack: (id) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.map((p: BackgroundPack) =>
      p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
    )
  })),

  setBackgroundIndex: (index) => set({ backgroundIndex: index }),

  updateBackgroundPackIndex: (id, index) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.map((p: BackgroundPack) =>
      p.id === id ? { ...p, currentIndex: index, updatedAt: new Date().toISOString() } : p
    )
  })),
});
