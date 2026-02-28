// ============================================
// Settings Slice - Application settings
// ============================================

import type { AppSettings } from '@/types';
import { defaultSettings } from '../defaults';

export interface SettingsSlice {
  // State
  settings: AppSettings;

  // Actions
  updateSettings: (updates: Partial<AppSettings>) => void;
}

export const createSettingsSlice = (set: any, _get: any): SettingsSlice => ({
  // Initial State
  settings: defaultSettings,

  // Actions
  updateSettings: (updates) => set((state: any) => ({
    settings: { ...state.settings, ...updates }
  })),
});
